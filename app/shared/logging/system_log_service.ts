import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import SystemLog from '#models/system_log'

export type SystemLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/** 30-day retention of `system_logs` (docs/backend/02 §10). */
export const SYSTEM_LOG_RETENTION_DAYS = 30

/**
 * `system_logs` (docs/backend/02 §10): events the back office must see (job
 * given up, payment discrepancy, integration error). Writing never throws:
 * a failure only reaches the process log.
 */
export class SystemLogService {
  async write(entry: {
    channel: string
    level: SystemLogLevel
    message: string
    organizationId?: string | null
    context?: Record<string, unknown>
  }) {
    try {
      await SystemLog.create({
        channel: entry.channel,
        level: entry.level,
        message: entry.message.slice(0, 2000),
        organizationId: entry.organizationId ?? null,
        context: entry.context ?? {},
      })
    } catch (error) {
      logger.error({ err: error, channel: entry.channel }, 'system_log.write_failed')
    }
  }

  /** `system-logs.purge` (daily): rows older than 30 days. */
  async purge(at: DateTime = DateTime.now()) {
    const deleted = await SystemLog.query()
      .where('created_at', '<', at.minus({ days: SYSTEM_LOG_RETENTION_DAYS }).toJSDate())
      .delete()
    return Array.isArray(deleted) ? deleted.length : Number(deleted)
  }
}

export default new SystemLogService()
