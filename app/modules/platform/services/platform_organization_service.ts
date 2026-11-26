import { DateTime } from 'luxon'
import Organization from '#models/organization'
import Plan from '#models/plan'
import type Subscription from '#models/subscription'
import type User from '#models/user'
import type { BillingCycle, SubscriptionStatus } from '#models/subscription'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import { TenantContext } from '#shared/tenant/tenant_context'
import { subscriptionsIn } from '#modules/billing/repositories/subscription_repository'
import billingService from '#modules/billing/services/billing_service'
import entitlementService, {
  computeEntitlements,
} from '#modules/billing/services/entitlement_service'
import { planAmount } from '#modules/billing/pricing'
import { PURGE_AFTER_DAYS } from '#modules/organizations/services/organization_purge_service'
import organizations, {
  type OrganizationListFilters,
} from '#modules/platform/repositories/platform_organization_repository'

const PAID_RUNNING: SubscriptionStatus[] = ['active', 'past_due', 'canceled']
const CHURN_DAYS = 30
const PAST_DUE_GRACE_DAYS = 7

export interface SubscriptionPatch {
  planId?: string
  status?: SubscriptionStatus
  cycle?: BillingCycle
  currentPeriodEnd?: DateTime
  trialEndsAt?: DateTime | null
  maxEmployeesOverride?: number | null
  modulesOverride?: string[] | null
}

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'status', rule, message }] })

/** When a subscription whose effective status is `expired` lost its access. */
function expiredAt(subscription: Subscription) {
  if (subscription.status === 'trialing' && subscription.trialEndsAt)
    return subscription.trialEndsAt
  if (['active', 'past_due'].includes(subscription.status)) {
    return subscription.currentPeriodEnd.plus({ days: PAST_DUE_GRACE_DAYS })
  }
  return subscription.currentPeriodEnd
}

/** Back-office organizations and subscriptions (docs/backend/06 §13, decisions of 2026-11-24). */
export class PlatformOrganizationService {
  /**
   * `GET /platform/dashboard`: MRR = monthly equivalent (yearly / 12) of the
   * running paid subscriptions; churn = paid plans whose access ended in the
   * last 30 days.
   */
  async dashboard(now: DateTime = DateTime.now()) {
    const [live, subscriptions] = await Promise.all([
      organizations.liveOrganizations(),
      organizations.currentSubscriptions(),
    ])
    const counts: Record<string, number> = {
      trialing: 0,
      active: 0,
      past_due: 0,
      canceled: 0,
      suspended: 0,
      expired: 0,
    }
    let mrr = 0
    let churn = 0
    for (const subscription of subscriptions) {
      const status = computeEntitlements(subscription, subscription.plan, now).status
      counts[status] += 1
      const paid = subscription.plan.code !== 'free'
      if (paid && PAID_RUNNING.includes(status)) {
        const amount = planAmount(subscription.plan, subscription.cycle)
        mrr += subscription.cycle === 'yearly' ? amount / 12 : amount
      }
      if (
        paid &&
        status === 'expired' &&
        expiredAt(subscription) >= now.minus({ days: CHURN_DAYS })
      ) {
        churn += 1
      }
    }
    return {
      organizations: { live, paying: counts.active + counts.past_due + counts.canceled },
      subscriptions: counts,
      mrrGnf: Math.round(mrr),
      churn30d: churn,
    }
  }

  list(filters: OrganizationListFilters) {
    return organizations.paginate(filters)
  }

  /** `GET /platform/organizations/:id`: the organization, its subscription, usage and owners. */
  async detail(id: string) {
    const organization = await organizations.find(id)
    if (!organization) throw new AppException('E_NOT_FOUND')
    const [subscription, counts, owners] = await Promise.all([
      organizations.currentSubscription(id),
      organizations.counts(id),
      organizations.owners(id),
    ])
    const usage = subscription
      ? await billingService.usage(new TenantContext(id, ['owner'], null))
      : null
    return {
      organization,
      subscription,
      entitlements: subscription ? computeEntitlements(subscription, subscription.plan) : null,
      usage,
      counts,
      owners,
    }
  }

  /** `PATCH /platform/organizations/:id/subscription` (root): any field, audited. */
  async updateSubscription(id: string, actor: User, patch: SubscriptionPatch, audit: AuditContext) {
    if (patch.planId) {
      const plan = await Plan.query().where('id', patch.planId).whereNull('deleted_at').first()
      if (!plan) throw AppException.validation('planId', 'exists', 'validation.billing.plan')
    }
    return this.change(id, actor, audit, 'platform.subscription_updated', (subscription) => {
      subscription.merge(patch)
    })
  }

  /** `POST /platform/organizations/:id/suspend` (root): `hr` read-only (07 §6.5). */
  suspend(id: string, actor: User, audit: AuditContext) {
    return this.change(id, actor, audit, 'platform.organization_suspended', (subscription) => {
      if (subscription.status === 'suspended' || subscription.status === 'expired') {
        throw conflict('notSuspendable', 'validation.platform.notSuspendable')
      }
      subscription.status = 'suspended'
    })
  }

  /** `POST /platform/organizations/:id/reactivate` (root): status recomputed from the term. */
  reactivate(id: string, actor: User, audit: AuditContext) {
    return this.change(id, actor, audit, 'platform.organization_reactivated', (subscription) => {
      if (subscription.status !== 'suspended') {
        throw conflict('notSuspended', 'validation.platform.notSuspended')
      }
      subscription.status =
        subscription.plan.code === 'free' && subscription.trialEndsAt ? 'trialing' : 'active'
      subscription.status = computeEntitlements(subscription, subscription.plan).status
    })
  }

  /**
   * `POST /platform/organizations/:id/restore` (root, decision of 2026-11-26):
   * cancels a `DELETE /org` within its 30 days. Afterwards the purge may be
   * running (`409`, `rule = "purged"`), so the two never touch the same row.
   */
  async restore(id: string, actor: User, audit: AuditContext, now: DateTime = DateTime.now()) {
    await withTenant(id, async (trx) => {
      const organization = await Organization.query({ client: trx })
        .where('id', id)
        .forUpdate()
        .first()
      if (!organization) throw new AppException('E_NOT_FOUND')
      if (!organization.deletedAt) throw conflict('notDeleted', 'validation.platform.notDeleted')
      if (organization.purgedAt || organization.deletedAt < now.minus({ days: PURGE_AFTER_DAYS })) {
        throw conflict('purged', 'validation.platform.purged')
      }
      const deletedAt = organization.deletedAt.toUTC().toISO()
      organization.merge({ deletedAt: null, updatedBy: actor.id })
      await organization.save()
      await auditService.record(
        trx,
        { ...audit, organizationId: id, actorUserId: actor.id, actorRole: 'platform_root' },
        {
          action: 'platform.organization_restored',
          targetType: 'organization',
          targetId: id,
          before: { deletedAt },
          after: { deletedAt: null },
        }
      )
    })
    await entitlementService.invalidate(id)
    return this.detail(id)
  }

  private async change(
    id: string,
    actor: User,
    audit: AuditContext,
    action: string,
    apply: (subscription: Subscription) => void
  ) {
    const organization = await organizations.find(id)
    if (!organization) throw new AppException('E_NOT_FOUND')
    await withTenant(id, async (trx) => {
      const subscriptions = subscriptionsIn(id, trx)
      const subscription = await subscriptions.currentForUpdate()
      if (!subscription) throw new AppException('E_SUBSCRIPTION_INACTIVE')
      const before = this.snapshot(subscription)
      apply(subscription)
      await subscriptions.save(subscription)
      await auditService.record(
        trx,
        { ...audit, organizationId: id, actorUserId: actor.id, actorRole: 'platform_root' },
        {
          action,
          targetType: 'subscription',
          targetId: subscription.id,
          before,
          after: this.snapshot(subscription),
        }
      )
    })
    await entitlementService.invalidate(id)
    return this.detail(id)
  }

  private snapshot(subscription: Subscription) {
    return {
      planId: subscription.planId,
      status: subscription.status,
      cycle: subscription.cycle,
      trialEndsAt: subscription.trialEndsAt?.toUTC().toISO() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd.toUTC().toISO(),
      maxEmployeesOverride: subscription.maxEmployeesOverride,
      modulesOverride: subscription.modulesOverride,
    }
  }
}

export default new PlatformOrganizationService()
