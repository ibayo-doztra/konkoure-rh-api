import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import UsageEvent from '#models/usage_event'
import { AppException } from '#shared/exceptions/app_exception'
import queueService from '#shared/queue/queue_service'
import { withTenant } from '#shared/tenant/with_tenant'
import { newId } from '#shared/utils/crypto'
import entitlementService from '#modules/billing/services/entitlement_service'
import { usagePeriod } from '#modules/billing/pricing'

const METRIC = 'ai_credits'

/** A reserved credit, to refund if the AI call does not produce a result. */
export interface CreditReservation {
  organizationId: string
  period: string
}

export interface UsageRecord {
  organizationId: string
  userId: string | null
  kind: 'ai'
  module: string
  path: string | null
  metadata: Record<string, unknown>
}

/**
 * Monthly AI credits (07 §6.8): one credit per AI call, reserved atomically
 * against the plan's `ai_credits_per_month` before the call, refunded when it
 * fails. The counter resets with the month (`period` = `AAAA-MM`).
 */
export class AiCreditService {
  async reserve(organizationId: string, at: DateTime = DateTime.now()): Promise<CreditReservation> {
    const entitlements = await entitlementService.resolve(organizationId)
    const limit = entitlements?.aiCreditsPerMonth ?? 0
    const period = usagePeriod(at)
    const reserved = await withTenant(organizationId, async (trx) => {
      // The limit follows the current plan, even after a change during the month.
      await trx.rawQuery(
        `INSERT INTO usage_counters (id, organization_id, period, metric, used, limit_value)
         VALUES (?, ?, ?, ?, 0, ?)
         ON CONFLICT (organization_id, period, metric) DO UPDATE SET limit_value = EXCLUDED.limit_value`,
        [newId(), organizationId, period, METRIC, limit]
      )
      const { rows } = await trx.rawQuery(
        `UPDATE usage_counters SET used = used + 1
          WHERE organization_id = ? AND period = ? AND metric = ? AND used < limit_value
          RETURNING used`,
        [organizationId, period, METRIC]
      )
      return rows.length > 0
    })
    if (!reserved) throw new AppException('E_AI_QUOTA_EXCEEDED')
    return { organizationId, period }
  }

  /** Gives back a reserved credit; never throws. */
  async refund(reservation: CreditReservation) {
    try {
      await withTenant(reservation.organizationId, (trx) =>
        trx.rawQuery(
          `UPDATE usage_counters SET used = GREATEST(used - 1, 0)
            WHERE organization_id = ? AND period = ? AND metric = ?`,
          [reservation.organizationId, reservation.period, METRIC]
        )
      )
    } catch (error) {
      logger.error({ err: error, ...reservation }, 'ai.credit_refund_failed')
    }
  }

  /** `usage_events` entry, written by the queue, never blocking (02 §7). */
  async record(entry: UsageRecord) {
    try {
      await queueService.dispatch('usage.record', entry)
    } catch (error) {
      logger.warn({ err: error, module: entry.module }, 'usage.record_dispatch_failed')
    }
  }

  /** The `usage.record` job. */
  write(entry: UsageRecord) {
    return withTenant(entry.organizationId, (trx) =>
      UsageEvent.create(
        {
          organizationId: entry.organizationId,
          userId: entry.userId,
          kind: entry.kind,
          module: entry.module,
          path: entry.path,
          metadata: entry.metadata,
        },
        { client: trx }
      )
    )
  }
}

export default new AiCreditService()
