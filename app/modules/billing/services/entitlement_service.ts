import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import type Plan from '#models/plan'
import type Subscription from '#models/subscription'
import type { BillingCycle, SubscriptionStatus } from '#models/subscription'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import { subscriptionsIn } from '#modules/billing/repositories/subscription_repository'

export type ModuleKey =
  | 'hr'
  | 'timeclock'
  | 'leaves'
  | 'performance'
  | 'recruitment'
  | 'talents'
  | 'settings'
  | 'integrations'
  | 'api'

export interface Entitlements {
  planCode: string
  planName: string
  status: SubscriptionStatus
  cycle: BillingCycle
  modules: string[]
  /** Modules kept in read-only mode by a suspended or expired subscription. */
  readOnlyModules: string[]
  maxEmployees: number
  aiCreditsPerMonth: number
  priceGnf: number
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  /** A paid plan is still effective, cancellation until its term included. */
  planEffective: boolean
}

const CACHE_TTL_SECONDS = 60
const PAST_DUE_GRACE_DAYS = 7
const RESTRICTED_MODULES = ['hr']

const cacheKey = (organizationId: string) => `entitlements:${organizationId}`

/** Status that applies now, even if the nightly lifecycle job has not run yet (07 §6.5). */
function effectiveStatus(subscription: Subscription, now: DateTime): SubscriptionStatus {
  const periodEnd = subscription.currentPeriodEnd
  const graceEnd = periodEnd.plus({ days: PAST_DUE_GRACE_DAYS })
  switch (subscription.status) {
    case 'trialing':
      return subscription.trialEndsAt && subscription.trialEndsAt > now ? 'trialing' : 'expired'
    case 'active':
      if (periodEnd > now) return 'active'
      return graceEnd > now ? 'past_due' : 'expired'
    case 'past_due':
      return graceEnd > now ? 'past_due' : 'expired'
    case 'canceled':
      return periodEnd > now ? 'canceled' : 'expired'
    default:
      return subscription.status
  }
}

/** Pure computation of the effective rights (07 §6.3, §6.5). */
export function computeEntitlements(
  subscription: Subscription,
  plan: Plan,
  now: DateTime = DateTime.now()
): Entitlements {
  const status = effectiveStatus(subscription, now)
  const restricted = status === 'suspended' || status === 'expired'
  const trialing = status === 'trialing'
  return {
    planCode: plan.code,
    planName: plan.name,
    status,
    cycle: subscription.cycle,
    modules: restricted ? RESTRICTED_MODULES : (subscription.modulesOverride ?? plan.modules),
    readOnlyModules: restricted ? RESTRICTED_MODULES : [],
    maxEmployees: subscription.maxEmployeesOverride ?? plan.maxEmployees,
    aiCreditsPerMonth: plan.aiCreditsPerMonth,
    priceGnf: Number(
      subscription.cycle === 'yearly' ? (plan.priceYearlyGnf ?? plan.priceGnf) : plan.priceGnf
    ),
    trialEndsAt: subscription.trialEndsAt?.toUTC().toISO() ?? null,
    currentPeriodEnd: trialing ? null : subscription.currentPeriodEnd.toUTC().toISO(),
    planEffective: plan.code !== 'free' && ['active', 'past_due', 'canceled'].includes(status),
  }
}

/** Refusal for a module (07 §6.4); `null` when access is granted. */
export function accessError(
  entitlements: Entitlements | null,
  module: ModuleKey,
  readOnlyRequest: boolean
): AppException | null {
  if (!entitlements) return new AppException('E_SUBSCRIPTION_INACTIVE')
  const included = entitlements.modules.includes(module)
  const writable = !entitlements.readOnlyModules.includes(module)
  if (included && (writable || readOnlyRequest)) return null

  const details = [
    { field: 'requiredModule', rule: module, message: 'validation.entitlement.requiredModule' },
    {
      field: 'currentPlan',
      rule: entitlements.planCode,
      message: 'validation.entitlement.currentPlan',
    },
  ]
  const inactive = entitlements.status === 'suspended' || entitlements.status === 'expired'
  return new AppException(inactive ? 'E_SUBSCRIPTION_INACTIVE' : 'E_MODULE_NOT_INCLUDED', {
    details,
  })
}

/** Single source of module rights, cached 60 s (07 §6.3). */
export class EntitlementService {
  async resolve(organizationId: string): Promise<Entitlements | null> {
    const cached = await this.readCache(organizationId)
    if (cached) return cached

    const subscription = await withTenant(organizationId, (trx) =>
      subscriptionsIn(organizationId, trx).current()
    )
    if (!subscription) return null
    const entitlements = computeEntitlements(subscription, subscription.plan)
    await this.writeCache(organizationId, entitlements)
    return entitlements
  }

  async assertAccess(organizationId: string, module: ModuleKey, readOnlyRequest: boolean) {
    const error = accessError(await this.resolve(organizationId), module, readOnlyRequest)
    if (error) throw error
  }

  /** Called after every subscription change (08 §3). */
  async invalidate(organizationId: string) {
    try {
      await redis.connection('cache').del(cacheKey(organizationId))
    } catch (error) {
      logger.warn({ err: error }, 'entitlements.cache_unavailable')
    }
  }

  // The cache only saves queries: a Redis outage falls back to PostgreSQL.
  private async readCache(organizationId: string): Promise<Entitlements | null> {
    try {
      const raw = await redis.connection('cache').get(cacheKey(organizationId))
      return raw ? (JSON.parse(raw) as Entitlements) : null
    } catch (error) {
      logger.warn({ err: error }, 'entitlements.cache_unavailable')
      return null
    }
  }

  private async writeCache(organizationId: string, entitlements: Entitlements) {
    try {
      await redis
        .connection('cache')
        .set(cacheKey(organizationId), JSON.stringify(entitlements), 'EX', CACHE_TTL_SECONDS)
    } catch (error) {
      logger.warn({ err: error }, 'entitlements.cache_unavailable')
    }
  }
}

export default new EntitlementService()
