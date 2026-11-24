import type Invoice from '#models/invoice'
import type Payment from '#models/payment'
import type Plan from '#models/plan'
import type Subscription from '#models/subscription'
import type { Entitlements } from '#modules/billing/services/entitlement_service'
import { planAmount } from '#modules/billing/pricing'

const planRef = (plan: Plan | null | undefined) =>
  plan ? { id: plan.id, code: plan.code, name: plan.name } : null

/** `GET /org/billing/plans`: prices in GNF, the yearly one as charged (10 months by default). */
export function planDto(plan: Plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    priceMonthlyGnf: planAmount(plan, 'monthly'),
    priceYearlyGnf: planAmount(plan, 'yearly'),
    maxEmployees: plan.maxEmployees,
    aiCreditsPerMonth: plan.aiCreditsPerMonth,
    modules: plan.modules,
    features: plan.features,
  }
}

/** `GET /org/billing/subscription`: `status` is the effective one (07 §6.5). */
export function subscriptionDto(subscription: Subscription, entitlements: Entitlements) {
  return {
    id: subscription.id,
    status: entitlements.status,
    plan: planRef(subscription.plan),
    cycle: subscription.cycle,
    trialEndsAt: subscription.trialEndsAt?.toUTC().toISO() ?? null,
    currentPeriodStart: subscription.currentPeriodStart.toUTC().toISO(),
    currentPeriodEnd: subscription.currentPeriodEnd.toUTC().toISO(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt?.toUTC().toISO() ?? null,
    scheduledPlan: subscription.scheduledPlanId ? planRef(subscription.scheduledPlan) : null,
    scheduledCycle: subscription.scheduledCycle,
  }
}

export function paymentDto(payment: Payment) {
  return {
    id: payment.id,
    merchantReference: payment.merchantReference,
    planId: payment.planId,
    cycle: payment.cycle,
    method: payment.method,
    status: payment.status,
    expectedAmount: Number(payment.expectedAmount),
    paidAmount: payment.paidAmount === null ? null : Number(payment.paidAmount),
    currency: payment.currency,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt.toUTC().toISO(),
    updatedAt: payment.updatedAt.toUTC().toISO(),
  }
}

export function invoiceDto(invoice: Invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    paymentId: invoice.paymentId,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    issuedAt: invoice.issuedAt.toUTC().toISO(),
    periodStart: invoice.periodStart.toUTC().toISO(),
    periodEnd: invoice.periodEnd.toUTC().toISO(),
    hasPdf: invoice.pdfPath !== null,
  }
}
