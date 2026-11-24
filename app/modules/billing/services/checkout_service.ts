import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Plan from '#models/plan'
import type Payment from '#models/payment'
import type Subscription from '#models/subscription'
import type User from '#models/user'
import type { BillingCycle } from '#models/subscription'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import env from '#start/env'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { subscriptionsIn } from '#modules/billing/repositories/subscription_repository'
import { paymentsIn } from '#modules/billing/repositories/payment_repository'
import entitlementService, {
  computeEntitlements,
} from '#modules/billing/services/entitlement_service'
import djomyClient from '#modules/billing/services/djomy_client'
import { planAmount } from '#modules/billing/pricing'

export type CheckoutMethod = 'orange_money' | 'mtn_momo' | 'card'

export interface CheckoutInput {
  planId: string
  cycle: BillingCycle
  method: CheckoutMethod
  payerPhone?: string
}

export type CheckoutResult =
  | { kind: 'payment'; payment: Payment; redirectUrl: string | null }
  | { kind: 'scheduled'; plan: Plan; cycle: BillingCycle; effectiveAt: DateTime }

/** Statuses of a paid period still running (07 §6.5). */
const PAID_RUNNING = ['active', 'past_due', 'canceled']

/** How the requested plan relates to the current one (07 §6.7). */
type Quote = { kind: 'charge'; amount: number } | { kind: 'downgrade' }

/**
 * Amount of a checkout (07 §6.7, decision of 2026-11-24): a downgrade from a
 * running paid plan is scheduled at the term; an upgrade pays the target
 * period minus the unused share of the current one; anything else (trial,
 * free, expired, renewal) pays the full period.
 */
export function quote(
  current: Subscription,
  target: Plan,
  cycle: BillingCycle,
  now: DateTime
): Quote {
  const status = computeEntitlements(current, current.plan, now).status
  const runningPaid =
    current.plan.code !== 'free' && PAID_RUNNING.includes(status) && current.currentPeriodEnd > now
  const full = planAmount(target, cycle)
  if (!runningPaid || current.planId === target.id) return { kind: 'charge', amount: full }

  if (planAmount(target, 'monthly') < planAmount(current.plan, 'monthly')) {
    return { kind: 'downgrade' }
  }
  const total = current.currentPeriodEnd.diff(current.currentPeriodStart).as('milliseconds')
  const remaining = current.currentPeriodEnd.diff(now).as('milliseconds')
  const credit = total > 0 ? (planAmount(current.plan, current.cycle) * remaining) / total : 0
  return { kind: 'charge', amount: Math.max(0, Math.round(full - credit)) }
}

/** `POST /org/billing/checkout` (06 §10, 07 §7.1-7.2). */
export class CheckoutService {
  async checkout(
    tenant: TenantContext,
    actor: User,
    input: CheckoutInput,
    audit: AuditContext
  ): Promise<CheckoutResult> {
    if (input.method !== 'card' && !input.payerPhone) {
      throw AppException.validation('payerPhone', 'required', 'validation.billing.payerPhone')
    }
    if (!djomyClient.configured) throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    const target = await Plan.query()
      .where('id', input.planId)
      .whereNull('deleted_at')
      .where('is_public', true)
      .whereNot('code', 'free')
      .first()
    if (!target) throw AppException.validation('planId', 'exists', 'validation.billing.plan')

    const { organizationId } = tenant
    const context = { ...audit, organizationId, actorRole: tenant.primaryRole }
    const prepared = await withTenant(organizationId, async (trx) => {
      const subscriptions = subscriptionsIn(organizationId, trx)
      const current = await subscriptions.currentForUpdate()
      if (!current) throw new AppException('E_SUBSCRIPTION_INACTIVE')
      const now = DateTime.now()
      const priced = quote(current, target, input.cycle, now)

      if (priced.kind === 'downgrade') {
        const headcount = await employeesIn(organizationId, trx).headcount()
        if (headcount > target.maxEmployees) {
          throw new AppException('E_QUOTA_EXCEEDED', {
            details: [
              {
                field: 'employees',
                rule: String(headcount - target.maxEmployees),
                message: 'validation.billing.downgradeQuota',
              },
            ],
          })
        }
        current.merge({ scheduledPlanId: target.id, scheduledCycle: input.cycle })
        await subscriptions.save(current)
        await auditService.record(trx, context, {
          action: 'subscription.downgrade_scheduled',
          targetType: 'subscription',
          targetId: current.id,
          after: { planId: target.id, cycle: input.cycle },
        })
        return { kind: 'scheduled' as const, effectiveAt: current.currentPeriodEnd }
      }

      if (priced.amount <= 0) {
        throw new AppException('E_CONFLICT', {
          details: [
            { field: 'planId', rule: 'nothingToPay', message: 'validation.billing.nothingToPay' },
          ],
        })
      }
      // The payment exists before Djomy is called (07 §7.1).
      const payment = await paymentsIn(organizationId, trx).create({
        planId: target.id,
        cycle: input.cycle,
        merchantReference: newId(),
        expectedAmount: String(priced.amount),
        method: input.method,
        payerPhone: input.payerPhone ?? null,
        createdBy: actor.id,
      })
      await auditService.record(trx, context, {
        action: 'payment.created',
        targetType: 'payment',
        targetId: payment.id,
        after: {
          planId: target.id,
          cycle: input.cycle,
          amount: priced.amount,
          method: input.method,
        },
      })
      return { kind: 'payment' as const, payment }
    })

    if (prepared.kind === 'scheduled') {
      await entitlementService.invalidate(organizationId)
      return {
        kind: 'scheduled',
        plan: target,
        cycle: input.cycle,
        effectiveAt: prepared.effectiveAt,
      }
    }
    return this.charge(tenant, prepared.payment, target, input)
  }

  /** Calls Djomy after the commit; a provider failure fails the payment (no money moved). */
  private async charge(tenant: TenantContext, payment: Payment, plan: Plan, input: CheckoutInput) {
    const amount = Number(payment.expectedAmount)
    const description = `Konkouré ${plan.name} (${input.cycle})`
    let transactionId: string | null = null
    let redirectUrl: string | null = null
    try {
      if (input.method === 'card') {
        const returnUrl = `${env.get('WEB_APP_URL')}/settings/billing?payment=${payment.id}`
        const result = await djomyClient.gateway({
          amount,
          merchantReference: payment.merchantReference,
          method: input.method,
          returnUrl,
          cancelUrl: returnUrl,
          description,
        })
        transactionId = result.transactionId
        redirectUrl = result.redirectUrl
      } else {
        const result = await djomyClient.directCharge({
          amount,
          merchantReference: payment.merchantReference,
          payerPhone: input.payerPhone!,
          method: input.method,
          description,
        })
        transactionId = result.transactionId
      }
    } catch (error) {
      logger.error({ err: error, paymentId: payment.id }, 'billing.checkout_provider_failed')
      await this.update(tenant, payment.id, {
        status: 'failed',
        failureReason: 'provider_unavailable',
      })
      throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    }
    const saved = await this.update(tenant, payment.id, { providerTransactionId: transactionId })
    return { kind: 'payment' as const, payment: saved, redirectUrl }
  }

  private update(tenant: TenantContext, id: string, changes: Partial<Payment>) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const payments = paymentsIn(organizationId, trx)
      const payment = await payments.findForUpdate(id)
      if (!payment) throw new AppException('E_NOT_FOUND')
      payment.merge(changes)
      return payments.save(payment)
    })
  }
}

export default new CheckoutService()
