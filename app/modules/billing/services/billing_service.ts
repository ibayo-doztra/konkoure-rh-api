import { DateTime } from 'luxon'
import type User from '#models/user'
import type Subscription from '#models/subscription'
import type { PaymentStatus } from '#models/payment'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { publicPlans, subscriptionsIn } from '#modules/billing/repositories/subscription_repository'
import {
  invoicesIn,
  paymentsIn,
  usageCountersIn,
} from '#modules/billing/repositories/payment_repository'
import entitlementService, {
  computeEntitlements,
} from '#modules/billing/services/entitlement_service'
import { usagePeriod } from '#modules/billing/pricing'

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'status', rule, message }] })

/** Organization billing read side, cancellation and resumption (06 §10, 07 §6). */
export class BillingService {
  /** The current subscription with its effective status (07 §6.5). */
  subscription(tenant: TenantContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const subscription = await subscriptionsIn(organizationId, trx).currentForUpdate()
      if (!subscription) throw new AppException('E_SUBSCRIPTION_INACTIVE')
      return { subscription, entitlements: computeEntitlements(subscription, subscription.plan) }
    })
  }

  plans() {
    return publicPlans()
  }

  /** Employees against the quota and AI credits of the month (06 §10). */
  usage(tenant: TenantContext, at: DateTime = DateTime.now()) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const subscription = await subscriptionsIn(organizationId, trx).current()
      if (!subscription) throw new AppException('E_SUBSCRIPTION_INACTIVE')
      const entitlements = computeEntitlements(subscription, subscription.plan, at)
      const period = usagePeriod(at)
      const counters = await usageCountersIn(organizationId, trx).ofPeriod(period)
      const aiCredits = counters.find((counter) => counter.metric === 'ai_credits')
      return {
        period,
        employees: {
          used: await employeesIn(organizationId, trx).headcount(),
          limit: entitlements.maxEmployees,
        },
        aiCredits: { used: aiCredits?.used ?? 0, limit: entitlements.aiCreditsPerMonth },
      }
    })
  }

  payments(
    tenant: TenantContext,
    filters: { page: number; perPage: number; status?: PaymentStatus }
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => paymentsIn(organizationId, trx).paginate(filters))
  }

  payment(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => paymentsIn(organizationId, trx).findOrFail(id))
  }

  invoices(tenant: TenantContext, filters: { page: number; perPage: number }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => invoicesIn(organizationId, trx).paginate(filters))
  }

  /**
   * Cancellation at the term (07 §6.6): access is kept until
   * `current_period_end`, never cut immediately.
   */
  cancel(tenant: TenantContext, actor: User, audit: AuditContext) {
    return this.change(tenant, actor, audit, (subscription, now) => {
      const status = computeEntitlements(subscription, subscription.plan, now).status
      if (subscription.plan.code === 'free' || !['active', 'past_due'].includes(status)) {
        throw conflict('notCancelable', 'validation.billing.notCancelable')
      }
      subscription.merge({ status: 'canceled', cancelAtPeriodEnd: true, canceledAt: now })
      return 'subscription.canceled'
    })
  }

  /** Resumption before the term (07 §6.6). */
  resume(tenant: TenantContext, actor: User, audit: AuditContext) {
    return this.change(tenant, actor, audit, (subscription, now) => {
      if (subscription.status !== 'canceled' || subscription.currentPeriodEnd <= now) {
        throw conflict('notResumable', 'validation.billing.notResumable')
      }
      subscription.merge({ status: 'active', cancelAtPeriodEnd: false, canceledAt: null })
      return 'subscription.resumed'
    })
  }

  private async change(
    tenant: TenantContext,
    actor: User,
    audit: AuditContext,
    apply: (subscription: Subscription, now: DateTime) => string
  ) {
    const { organizationId } = tenant
    const result = await withTenant(organizationId, async (trx) => {
      const subscriptions = subscriptionsIn(organizationId, trx)
      const subscription = await subscriptions.currentForUpdate()
      if (!subscription) throw new AppException('E_SUBSCRIPTION_INACTIVE')
      const before = {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      }
      const action = apply(subscription, DateTime.now())
      await subscriptions.save(subscription)
      await auditService.record(
        trx,
        { ...audit, organizationId, actorRole: tenant.primaryRole, actorUserId: actor.id },
        {
          action,
          targetType: 'subscription',
          targetId: subscription.id,
          before,
          after: { status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
        }
      )
      return { subscription, entitlements: computeEntitlements(subscription, subscription.plan) }
    })
    await entitlementService.invalidate(organizationId)
    return result
  }
}

export default new BillingService()
