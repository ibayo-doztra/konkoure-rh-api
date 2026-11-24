import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import type { SubscriptionStatus } from '#models/subscription'
import auditService from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import organizations from '#modules/organizations/repositories/organization_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import notificationService from '#modules/notifications/services/notification_service'
import { subscriptionsIn } from '#modules/billing/repositories/subscription_repository'
import entitlementService, {
  computeEntitlements,
} from '#modules/billing/services/entitlement_service'

/** Days before the end of the trial when the owners are told (08 §2, J−7 and J−1). */
const TRIAL_NOTICES = [7, 1]
const MARKER_TTL_SECONDS = 10 * 24 * 3600

interface Outcome {
  changed: boolean
  trialNotice: { daysLeft: number; endDate: string; owners: MailAccount[] } | null
}

/**
 * `subscriptions:lifecycle` (docs/backend/08 §2, 01h00): persists the status
 * that `computeEntitlements` already applies on the fly (end of trial,
 * `past_due`, `expired`), applies a scheduled downgrade at the term (decision
 * of 2026-11-24) and tells the owners before the end of the trial.
 */
export class SubscriptionLifecycleService {
  async run(at: DateTime = DateTime.now()) {
    let changed = 0
    let notified = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        const outcome = await this.organization(organizationId, at)
        if (outcome.changed) {
          changed += 1
          await entitlementService.invalidate(organizationId)
        }
        if (outcome.trialNotice && (await this.notifyTrial(organizationId, outcome.trialNotice))) {
          notified += 1
        }
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'subscriptions.lifecycle_failed')
      }
    }
    logger.info({ changed, notified, failed: failed.length }, 'subscriptions.lifecycle_done')
    if (failed.length > 0) {
      throw new Error(`subscriptions:lifecycle failed for ${failed.length} organization(s)`)
    }
    return { changed, notified }
  }

  private organization(organizationId: string, at: DateTime): Promise<Outcome> {
    return withTenant(organizationId, async (trx) => {
      const subscriptions = subscriptionsIn(organizationId, trx)
      const subscription = await subscriptions.currentForUpdate()
      if (!subscription) return { changed: false, trialNotice: null }

      const before: { status: SubscriptionStatus; planId: string } = {
        status: subscription.status,
        planId: subscription.planId,
      }
      // A scheduled plan replaces the current one once its period is over.
      if (subscription.scheduledPlanId && subscription.currentPeriodEnd <= at) {
        subscription.merge({
          planId: subscription.scheduledPlanId,
          cycle: subscription.scheduledCycle ?? subscription.cycle,
          scheduledPlanId: null,
          scheduledCycle: null,
        })
      }
      const status = computeEntitlements(subscription, subscription.plan, at).status
      if (status !== subscription.status) {
        subscription.status = status
        if (status === 'expired') subscription.cancelAtPeriodEnd = false
      }

      const changed = subscription.$isDirty
      if (changed) {
        await subscriptions.save(subscription)
        await auditService.record(
          trx,
          { organizationId },
          {
            action: 'subscription.lifecycle',
            targetType: 'subscription',
            targetId: subscription.id,
            before,
            after: { status: subscription.status, planId: subscription.planId },
          }
        )
      }

      let trialNotice: Outcome['trialNotice'] = null
      if (subscription.status === 'trialing' && subscription.trialEndsAt) {
        const organization = await organizations.findActive(organizationId, trx)
        const zone = organization?.timezone ?? 'Africa/Conakry'
        const endDay = subscription.trialEndsAt.setZone(zone).startOf('day')
        const daysLeft = Math.round(endDay.diff(at.setZone(zone).startOf('day'), 'days').days)
        if (TRIAL_NOTICES.includes(daysLeft)) {
          trialNotice = {
            daysLeft,
            endDate: endDay.toISODate()!,
            owners: await membersIn(organizationId, trx).accountsWithRole('owner'),
          }
        }
      }
      return { changed, trialNotice }
    })
  }

  /** Once per organization, notice and trial end, even if the job runs twice. */
  private async notifyTrial(organizationId: string, notice: NonNullable<Outcome['trialNotice']>) {
    if (
      !(await this.claim(`trial_ending:${organizationId}:${notice.endDate}:${notice.daysLeft}`))
    ) {
      return false
    }
    await notificationService.notify(
      organizationId,
      notice.owners,
      {
        type: 'trial.ending',
        key: 'trialEnding',
        data: { daysLeft: String(notice.daysLeft), endDate: notice.endDate },
        link: '/billing',
        payload: { daysLeft: notice.daysLeft, trialEndsAt: notice.endDate },
      },
      null
    )
    return true
  }

  /** A Redis outage notifies rather than stays silent. */
  private async claim(key: string) {
    try {
      const set = await redis.connection('cache').set(key, '1', 'EX', MARKER_TTL_SECONDS, 'NX')
      return set === 'OK'
    } catch (error) {
      logger.warn({ err: error }, 'subscriptions.lifecycle_marker_unavailable')
      return true
    }
  }
}

export default new SubscriptionLifecycleService()
