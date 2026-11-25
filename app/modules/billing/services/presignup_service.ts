import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Invoice from '#models/invoice'
import Payment from '#models/payment'
import Plan from '#models/plan'
import type Organization from '#models/organization'
import type User from '#models/user'
import type { BillingCycle } from '#models/subscription'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import queueService from '#shared/queue/queue_service'
import { newId, randomToken, sha256 } from '#shared/utils/crypto'
import env from '#start/env'
import organizationService from '#modules/organizations/services/organization_service'
import organizations from '#modules/organizations/repositories/organization_repository'
import { withTenant } from '#shared/tenant/with_tenant'
import { TenantContext } from '#shared/tenant/tenant_context'
import memberships from '#modules/users/repositories/membership_repository'
import { paymentsIn } from '#modules/billing/repositories/payment_repository'
import ledger from '#modules/billing/repositories/payment_ledger'
import entitlementService from '#modules/billing/services/entitlement_service'
import djomyClient from '#modules/billing/services/djomy_client'
import {
  chargeWithDjomy,
  purchasablePlan,
  type CheckoutMethod,
} from '#modules/billing/services/checkout_service'
import { PaymentSucceededMail } from '#modules/billing/mails/payment_mails'
import { activatePaidPeriod } from '#modules/billing/services/paid_period'
import { planAmount } from '#modules/billing/pricing'

/** A claim code is valid 7 days (07 §7.7). */
const CLAIM_DAYS = 7

export interface PresignupCheckoutInput {
  planId: string
  cycle: BillingCycle
  method: CheckoutMethod
  payerPhone?: string
  email: string
}

const claimInvalid = (rule: string) =>
  new AppException('E_CLAIM_INVALID', {
    details: [{ field: 'claimToken', rule, message: `validation.billing.claim.${rule}` }],
  })

/** `a***@domain.gn`: enough for the visitor to recognize the address. */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain ?? ''}`
}

/**
 * Payment before sign-up (06 §11, 07 §7.7, decisions of 2026-11-24): the
 * payment lives outside any tenant until the payer, signed up with the same
 * e-mail, claims it to create the organization on the paid plan.
 */
export class PresignupService {
  /** `POST /public/payments/checkout`: full price, no prorata. */
  async checkout(input: PresignupCheckoutInput) {
    if (input.method !== 'card' && !input.payerPhone) {
      throw AppException.validation('payerPhone', 'required', 'validation.billing.payerPhone')
    }
    const plan = await purchasablePlan(input.planId)
    if (!djomyClient.configured) throw new AppException('E_DEPENDENCY_UNAVAILABLE')

    const claimToken = randomToken(24, 'clm_')
    const payment = await db.transaction((trx) =>
      Payment.create(
        {
          organizationId: null,
          planId: plan.id,
          cycle: input.cycle,
          merchantReference: newId(),
          expectedAmount: String(planAmount(plan, input.cycle)),
          method: input.method,
          payerPhone: input.payerPhone ?? null,
          claimTokenHash: sha256(claimToken),
          claimEmail: input.email,
          claimExpiresAt: DateTime.now().plus({ days: CLAIM_DAYS }),
        },
        { client: trx }
      )
    )

    const returnUrl = `${env.get('WEB_APP_URL')}/paiement/retour?ref=${payment.merchantReference}`
    const { transactionId, redirectUrl } = await chargeWithDjomy(
      payment,
      plan,
      input,
      returnUrl,
      () =>
        this.update(payment.merchantReference, {
          status: 'failed',
          failureReason: 'provider_unavailable',
        })
    )
    const saved = await this.update(payment.merchantReference, {
      providerTransactionId: transactionId,
    })
    return { payment: saved, claimToken, redirectUrl }
  }

  /** `GET /public/payments/:ref`: status only, for the holder of the claim code. */
  async status(merchantReference: string, claimToken: string | undefined) {
    const payment = await this.withToken(merchantReference, claimToken)
    const plan = await Plan.findOrFail(payment.planId)
    return { payment, plan }
  }

  /**
   * `POST /public/payments/:ref/claim` (07 §7.7): creates the organization of
   * the signed-up payer and activates the paid plan, in one transaction.
   */
  async claim(
    user: User,
    merchantReference: string,
    input: { claimToken: string; organizationName: string },
    audit: AuditContext
  ): Promise<{ organization: Organization; planCode: string | null }> {
    const payment = await this.claimable(user, merchantReference, input.claimToken)

    let invoice: Invoice | null = null
    const organization = await organizationService.create(
      user,
      { name: input.organizationName },
      audit,
      async (organizationId, trx, context) => {
        invoice = await this.bindAndActivate(
          trx,
          payment,
          input.claimToken,
          organizationId,
          context
        )
      }
    )
    return this.announce(user, organization, payment, invoice)
  }

  /**
   * `POST /public/payments/:ref/claim` with `organizationId` (decision of
   * 2026-11-25): attaches the payment to an organization the caller already
   * owns (checked by the controller). The running subscription follows the
   * in-app payment rule (07 §7.5): same paid plan and cycle → extended,
   * otherwise replaced from now.
   */
  async claimInto(
    user: User,
    merchantReference: string,
    input: { claimToken: string; organizationId: string },
    audit: AuditContext
  ): Promise<{ organization: Organization; planCode: string | null }> {
    if (!user.emailVerifiedAt) throw new AppException('E_EMAIL_NOT_VERIFIED')
    const payment = await this.claimable(user, merchantReference, input.claimToken)
    const { organizationId } = input

    let invoice: Invoice | null = null
    const organization = await withTenant(organizationId, async (trx) => {
      const found = await organizations.findActiveForUpdate(organizationId, trx)
      if (!found) throw new AppException('E_NOT_FOUND')
      const context = { ...audit, organizationId, actorRole: 'owner' }
      invoice = await this.bindAndActivate(trx, payment, input.claimToken, organizationId, context)
      return found
    })
    return this.announce(user, organization, payment, invoice)
  }

  /**
   * The caller's context in the target organization, for `BillingPolicy`:
   * `404` when they are not a member or it is deleted (01 §4, nothing leaks).
   */
  async targetContext(user: User, organizationId: string) {
    const roles = await memberships.rolesIn(user.id, organizationId)
    if (roles.length === 0) throw new AppException('E_NOT_FOUND')
    return new TenantContext(organizationId, roles, null)
  }

  /** The payment the signed-up user may claim (06 §11), or `409 E_CLAIM_INVALID`. */
  private async claimable(user: User, merchantReference: string, claimToken: string) {
    const payment = await this.withToken(merchantReference, claimToken)
    if (payment.organizationId || payment.claimedAt) throw claimInvalid('used')
    if (!payment.claimExpiresAt || payment.claimExpiresAt <= DateTime.now()) {
      throw claimInvalid('expired')
    }
    if (payment.claimEmail?.toLowerCase() !== user.email.toLowerCase()) throw claimInvalid('email')
    if (payment.status !== 'succeeded') throw claimInvalid('notPaid')
    return payment
  }

  /** In the claim transaction: binds once, activates the paid period, audits. */
  private async bindAndActivate(
    trx: TransactionClientContract,
    payment: Payment,
    claimToken: string,
    organizationId: string,
    context: AuditContext
  ) {
    const claimed = await this.bind(trx, payment, claimToken, organizationId)
    const invoice = await activatePaidPeriod(trx, organizationId, claimed)
    await auditService.record(trx, context, {
      action: 'payment.claimed',
      targetType: 'payment',
      targetId: claimed.id,
      after: {
        planId: claimed.planId,
        cycle: claimed.cycle,
        subscriptionId: claimed.subscriptionId,
      },
    })
    return invoice
  }

  /** After the commit: entitlements refreshed, confirmation e-mail, invoice PDF. */
  private async announce(
    user: User,
    organization: Organization,
    payment: Payment,
    invoice: Invoice | null
  ) {
    await entitlementService.invalidate(organization.id)
    const plan = await Plan.find(payment.planId)
    if (invoice) {
      const issued: Invoice = invoice
      await dispatchMail(
        new PaymentSucceededMail(user, {
          plan: plan?.name ?? '',
          amount: String(Number(payment.paidAmount ?? payment.expectedAmount)),
          invoiceNumber: issued.number,
          periodEnd: issued.periodEnd.toISODate()!,
        })
      )
      await queueService.dispatch('invoices.render', {
        organizationId: organization.id,
        invoiceId: issued.id,
      })
    }
    return { organization, planCode: plan?.code ?? null }
  }

  /** The payment, if the claim code matches; `404` otherwise, so nothing leaks. */
  private async withToken(merchantReference: string, claimToken: string | undefined) {
    const payment = claimToken ? await ledger.resolve(merchantReference) : null
    if (!payment || !payment.claimTokenHash || payment.claimTokenHash !== sha256(claimToken!)) {
      throw new AppException('E_NOT_FOUND')
    }
    return payment
  }

  /** Single use, even under concurrent claims (`claim_payment`, 0097). */
  private async bind(
    trx: TransactionClientContract,
    payment: Payment,
    claimToken: string,
    organizationId: string
  ) {
    const { rows } = await trx.rawQuery('select claim_payment(?, ?, ?) as id', [
      payment.merchantReference,
      sha256(claimToken),
      organizationId,
    ])
    if (!rows[0]?.id) throw claimInvalid('used')
    return paymentsIn(organizationId, trx).findOrFail(payment.id)
  }

  /** Writes a pre-signup payment, outside any tenant. */
  private update(merchantReference: string, changes: Partial<Payment>) {
    return db.transaction(async (trx) => {
      const payment = await ledger.findByReferenceForUpdate(merchantReference, trx)
      if (!payment) throw new AppException('E_NOT_FOUND')
      payment.merge(changes)
      return payment.useTransaction(trx).save()
    })
  }
}

export default new PresignupService()
