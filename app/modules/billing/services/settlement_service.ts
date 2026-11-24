import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Invoice from '#models/invoice'
import type Payment from '#models/payment'
import type { PaymentStatus } from '#models/payment'
import Plan from '#models/plan'
import auditService from '#shared/audit/audit_service'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import queueService from '#shared/queue/queue_service'
import { withTenant } from '#shared/tenant/with_tenant'
import receipts from '#shared/webhooks/receipt_repository'
import { membersIn } from '#modules/organizations/repositories/member_repository'
import notificationService from '#modules/notifications/services/notification_service'
import { subscriptionsIn } from '#modules/billing/repositories/subscription_repository'
import { invoicesIn, paymentsIn } from '#modules/billing/repositories/payment_repository'
import ledger from '#modules/billing/repositories/payment_ledger'
import entitlementService, {
  computeEntitlements,
} from '#modules/billing/services/entitlement_service'
import djomyClient, {
  readTransaction,
  type DjomyTransaction,
} from '#modules/billing/services/djomy_client'
import { PaymentSucceededMail } from '#modules/billing/mails/payment_mails'
import { periodEnd } from '#modules/billing/pricing'

export const DJOMY_PROVIDER = 'djomy'
/** A payment still pending after 30 minutes expires (07 §7.6). */
export const PENDING_MINUTES = 30
const RECONCILE_HOURS = 48

export type SettleOutcome =
  'unknown' | 'no_transaction' | 'pending' | 'succeeded' | 'failed' | 'already_settled' | 'late'

type InboundOutcome = 'invalid_signature' | 'duplicate' | 'accepted'

/** Statuses of a paid period still running, which a renewal extends (07 §7.5). */
const PAID_RUNNING = ['active', 'past_due', 'canceled']

/**
 * Djomy payment settlement (07 §7.4-7.6, 08 §5): a payment succeeds only
 * when Djomy itself confirms the transaction and its amount, whatever the
 * webhook or the client say.
 */
export class SettlementService {
  /** `POST /webhooks/djomy/:token`: checks, journals once, settles in the queue. */
  async receive(input: {
    token: string
    rawBody: string
    signature: string | undefined
  }): Promise<InboundOutcome> {
    if (
      !djomyClient.verifyPathToken(input.token) ||
      !djomyClient.verifyWebhook(input.rawBody, input.signature)
    ) {
      logger.warn('djomy.webhook_signature_rejected')
      return 'invalid_signature'
    }
    let body: unknown = null
    try {
      body = JSON.parse(input.rawBody)
    } catch {
      body = null
    }
    const event = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const data = (event.data && typeof event.data === 'object' ? event.data : event) as Record<
      string,
      unknown
    >
    const eventId =
      (typeof event.eventId === 'string' && event.eventId) ||
      createHash('sha256').update(input.rawBody).digest('hex')
    const receiptId = await receipts.record(DJOMY_PROVIDER, eventId, {
      merchantReference: data.merchantPaymentReference ?? data.merchant_payment_reference ?? null,
      transactionId: readTransaction(body).transactionId,
      event: body,
    })
    if (!receiptId) return 'duplicate'
    await queueService.dispatch('payments.settle', { receiptId })
    return 'accepted'
  }

  /** The `payments.settle` job. */
  async processReceipt({ receiptId }: { receiptId: string }) {
    const receipt = await receipts.find(receiptId)
    if (!receipt || receipt.processedAt) return 'skipped'
    const { merchantReference, transactionId } = receipt.payload as {
      merchantReference: string | null
      transactionId: string | null
    }
    const outcome =
      typeof merchantReference === 'string'
        ? await this.settle(merchantReference, transactionId)
        : 'unknown'
    receipt.merge({
      processedAt: DateTime.now(),
      error: ['unknown', 'no_transaction'].includes(outcome) ? outcome : null,
    })
    await receipts.save(receipt)
    return outcome
  }

  /** Verifies the transaction with Djomy, then applies the result once. */
  async settle(merchantReference: string, hintTransactionId: string | null = null) {
    const payment = await ledger.resolve(merchantReference)
    if (!payment) {
      logger.warn({ merchantReference }, 'djomy.payment_unknown')
      return 'unknown'
    }
    const transactionId = payment.providerTransactionId ?? hintTransactionId
    if (!transactionId) return 'no_transaction'
    const remote = await djomyClient.status(transactionId)
    if (remote.status === 'pending') return 'pending'
    return this.apply(payment, { ...remote, transactionId: remote.transactionId ?? transactionId })
  }

  /** `payments:poll-pending` (every 5 min): pending payments of the last 30 minutes. */
  async pollPending(at: DateTime = DateTime.now()) {
    let settled = 0
    for (const payment of await ledger.pendingSince(at.minus({ minutes: PENDING_MINUTES }))) {
      try {
        const outcome = await this.settle(payment.merchantReference)
        if (outcome === 'succeeded' || outcome === 'failed') settled += 1
      } catch (error) {
        logger.warn({ err: error, paymentId: payment.id }, 'payments.poll_failed')
      }
    }
    return settled
  }

  /** `payments:expire` (hourly): a payment pending for more than 30 minutes expires (07 §7.6). */
  async expirePending(at: DateTime = DateTime.now()) {
    let expired = 0
    for (const stale of await ledger.pendingBefore(at.minus({ minutes: PENDING_MINUTES }))) {
      await this.inScope(stale, async (trx, payment) => {
        if (payment.status !== 'pending') return
        payment.merge({ status: 'expired', failureReason: 'timeout' })
        await payment.useTransaction(trx).save()
        expired += 1
      })
    }
    return expired
  }

  /**
   * `payments:reconcile` (hourly, 48 h): a failed or expired payment that
   * Djomy reports as paid is flagged for manual reconciliation (07 §7.8).
   */
  async reconcile(at: DateTime = DateTime.now()) {
    let flagged = 0
    for (const payment of await ledger.unsuccessfulSince(at.minus({ hours: RECONCILE_HOURS }))) {
      try {
        const remote = await djomyClient.status(payment.providerTransactionId!)
        const alreadyFlagged = ['remote_succeeded', 'late_success'].includes(
          payment.failureReason ?? ''
        )
        if (remote.status !== 'succeeded' || alreadyFlagged) continue
        await this.inScope(payment, async (trx, row) => {
          row.merge({ failureReason: 'remote_succeeded', rawEvent: remote.raw })
          await row.useTransaction(trx).save()
        })
        logger.error(
          { paymentId: payment.id, organizationId: payment.organizationId },
          'payments.reconcile_mismatch'
        )
        flagged += 1
      } catch (error) {
        logger.warn({ err: error, paymentId: payment.id }, 'payments.reconcile_failed')
      }
    }
    return flagged
  }

  private async apply(found: Payment, remote: DjomyTransaction): Promise<SettleOutcome> {
    const result: { outcome: SettleOutcome; invoice: Invoice | null } = {
      outcome: 'already_settled',
      invoice: null,
    }
    await this.inScope(found, async (trx, payment) => {
      if (payment.status === 'succeeded' || payment.status === 'failed') return
      if (payment.status === 'expired') {
        // A late confirmation never activates anything: left to manual reconciliation.
        if (remote.status === 'succeeded') {
          payment.merge({ failureReason: 'late_success', rawEvent: remote.raw })
          await payment.useTransaction(trx).save()
          logger.error({ paymentId: payment.id }, 'payments.late_success')
          result.outcome = 'late'
        }
        return
      }

      payment.merge({ providerTransactionId: remote.transactionId, rawEvent: remote.raw })
      const paid = remote.paidAmount ?? 0
      const currency = (remote.currency ?? 'GNF').toUpperCase()
      if (remote.status === 'failed') {
        payment.merge({ status: 'failed', failureReason: 'provider_failed' })
      } else if (paid < Number(payment.expectedAmount) || currency !== 'GNF') {
        payment.merge({
          status: 'failed',
          paidAmount: String(paid),
          failureReason: 'amount_mismatch',
        })
        logger.error(
          { paymentId: payment.id, expected: payment.expectedAmount, paid, currency },
          'payments.amount_mismatch'
        )
      } else {
        payment.merge({ status: 'succeeded', paidAmount: String(paid), failureReason: null })
      }
      await payment.useTransaction(trx).save()
      const succeeded = (payment.status as PaymentStatus) === 'succeeded'

      if (payment.organizationId && succeeded) {
        result.invoice = await this.activate(trx, payment)
      }
      if (payment.organizationId) {
        await auditService.record(
          trx,
          { organizationId: payment.organizationId },
          {
            action: `payment.${payment.status}`,
            targetType: 'payment',
            targetId: payment.id,
            after: {
              status: payment.status,
              paidAmount: paid,
              failureReason: payment.failureReason,
            },
          }
        )
      }
      result.outcome = succeeded ? 'succeeded' : 'failed'
    })

    const { outcome, invoice } = result
    if (found.organizationId && (outcome === 'succeeded' || outcome === 'failed')) {
      await entitlementService.invalidate(found.organizationId)
      await this.announce(found.organizationId, found.id, outcome, invoice)
    }
    return outcome
  }

  /**
   * Activation (07 §7.5): a renewal of the running plan extends its period;
   * otherwise (trial, expired, upgrade) a new period starts now.
   */
  private async activate(trx: TransactionClientContract, payment: Payment) {
    const organizationId = payment.organizationId!
    const subscriptions = subscriptionsIn(organizationId, trx)
    const current = await subscriptions.currentForUpdate()
    const now = DateTime.now()
    const status = current ? computeEntitlements(current, current.plan, now).status : null
    const renewal =
      current !== null &&
      current.planId === payment.planId &&
      current.cycle === payment.cycle &&
      status !== null &&
      PAID_RUNNING.includes(status)

    let subscription
    let start: DateTime
    if (renewal) {
      start = current.currentPeriodEnd > now ? current.currentPeriodEnd : now
      current.merge({
        status: 'active',
        currentPeriodEnd: periodEnd(start, payment.cycle),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        scheduledPlanId: null,
        scheduledCycle: null,
      })
      subscription = await subscriptions.save(current)
    } else {
      start = now
      await subscriptions.expireCurrent()
      subscription = await subscriptions.createPaid({
        planId: payment.planId,
        cycle: payment.cycle,
        startsAt: start,
        endsAt: periodEnd(start, payment.cycle),
        maxEmployeesOverride: current?.maxEmployeesOverride ?? null,
        modulesOverride: current?.modulesOverride ?? null,
      })
    }
    payment.subscriptionId = subscription.id
    await payment.useTransaction(trx).save()
    return invoicesIn(organizationId, trx).create({
      subscriptionId: subscription.id,
      paymentId: payment.id,
      amount: Number(payment.paidAmount),
      issuedAt: now,
      periodStart: start,
      periodEnd: subscription.currentPeriodEnd,
    })
  }

  /** After the commit: owners notified, confirmation e-mail, invoice PDF (07 §7.5). */
  private async announce(
    organizationId: string,
    paymentId: string,
    outcome: 'succeeded' | 'failed',
    invoice: Invoice | null
  ) {
    const { owners, payment, plan } = await withTenant(organizationId, async (trx) => {
      const row = await paymentsIn(organizationId, trx).findOrFail(paymentId)
      return {
        owners: await membersIn(organizationId, trx).accountsWithRole('owner'),
        payment: row,
        plan: await Plan.find(row.planId, { client: trx }),
      }
    })
    const amount = String(Number(payment.paidAmount ?? payment.expectedAmount))
    await notificationService.notify(
      organizationId,
      owners,
      {
        type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
        key: outcome === 'succeeded' ? 'paymentSucceeded' : 'paymentFailed',
        data: { plan: plan?.name ?? '', amount },
        link: '/billing',
        payload: { paymentId, invoiceId: invoice?.id ?? null },
      },
      null
    )
    if (outcome === 'succeeded' && invoice) {
      for (const owner of owners) {
        await dispatchMail(
          new PaymentSucceededMail(owner, {
            plan: plan?.name ?? '',
            amount,
            invoiceNumber: invoice.number,
            periodEnd: invoice.periodEnd.toISODate()!,
          })
        )
      }
      await queueService.dispatch('invoices.render', { organizationId, invoiceId: invoice.id })
    }
  }

  /**
   * Runs `work` on the locked payment: in its tenant, or, for a payment made
   * before sign-up, outside any tenant (07 §7.7).
   */
  private async inScope(
    payment: Payment,
    work: (trx: TransactionClientContract, locked: Payment) => Promise<void>
  ) {
    if (payment.organizationId) {
      const organizationId = payment.organizationId
      return withTenant(organizationId, async (trx) => {
        const locked = await paymentsIn(organizationId, trx).findForUpdate(payment.id)
        if (locked) await work(trx, locked)
      })
    }
    return db.transaction(async (trx) => {
      const locked = await ledger.findByReferenceForUpdate(payment.merchantReference, trx)
      if (locked) await work(trx, locked)
    })
  }
}

export default new SettlementService()
