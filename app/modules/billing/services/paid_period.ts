import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Payment from '#models/payment'
import { subscriptionsIn } from '#modules/billing/repositories/subscription_repository'
import { invoicesIn } from '#modules/billing/repositories/payment_repository'
import { computeEntitlements } from '#modules/billing/services/entitlement_service'
import { periodEnd } from '#modules/billing/pricing'

/** Statuses of a paid period still running, which a renewal extends (07 §7.5). */
const PAID_RUNNING = ['active', 'past_due', 'canceled']

/**
 * Activation of a succeeded payment in its organization (07 §7.5), shared by
 * the in-app settlement and the claim of a payment made before sign-up
 * (decision of 2026-11-25): a renewal of the running paid plan and cycle
 * extends its period; otherwise (none, trial, expired, other plan or cycle)
 * the current subscription ends and a new period starts now. Records the
 * subscription on the payment and returns the invoice.
 */
export async function activatePaidPeriod(
  trx: TransactionClientContract,
  organizationId: string,
  payment: Payment
) {
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
    amount: Number(payment.paidAmount ?? payment.expectedAmount),
    issuedAt: now,
    periodStart: start,
    periodEnd: subscription.currentPeriodEnd,
  })
}
