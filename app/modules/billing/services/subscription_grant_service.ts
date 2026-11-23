import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { AppException } from '#shared/exceptions/app_exception'
import auditService from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import organizations from '#modules/organizations/repositories/organization_repository'
import {
  findPlanByCode,
  subscriptionsIn,
} from '#modules/billing/repositories/subscription_repository'
import entitlementService from '#modules/billing/services/entitlement_service'

/**
 * Grants a plan to an organization outside the payment flow (decision of
 * 2026-11-23): end-to-end tests and local support until the platform back
 * office (lot 10). Refused in production, where only Djomy activates a plan.
 * The previous subscription is expired (one live row per organization) and
 * the grant takes effect at once.
 */
export class SubscriptionGrantService {
  async grant(organizationId: string, planCode: string, days: number) {
    if (app.inProduction) throw new Error('subscription:grant is disabled in production')
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      throw new Error('--days must be an integer between 1 and 366')
    }
    const subscription = await withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      const plan = await findPlanByCode(planCode, trx)
      if (!plan) throw new Error(`Unknown plan "${planCode}"`)
      const now = DateTime.now()
      const subscriptions = subscriptionsIn(organizationId, trx)
      await subscriptions.expireCurrent()
      const row = await subscriptions.createGranted(plan.id, now, now.plus({ days }))
      await auditService.record(
        trx,
        { organizationId, actorRole: 'system' },
        {
          action: 'subscription.granted',
          targetType: 'subscription',
          targetId: row.id,
          after: { planCode, days },
        }
      )
      return row
    })
    await entitlementService.invalidate(organizationId)
    return subscription
  }
}

export default new SubscriptionGrantService()
