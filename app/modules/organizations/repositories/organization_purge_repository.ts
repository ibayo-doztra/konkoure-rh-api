import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

/**
 * Tenant tables emptied by the 30-day purge (decision of 2026-11-26), children
 * first. Every table with an `organization_id` is either here or in
 * `KEPT_TABLES`: a test fails when a new table is in neither list.
 */
export const PURGED_TABLES = [
  'social_posts',
  'social_accounts',
  'candidate_events',
  'candidate_notes',
  'candidates',
  'recruitment_webhook_configs',
  'jobs',
  'succession_plans',
  'achievements',
  'feedbacks',
  'review_goal_comments',
  'okr_checkins',
  'okr_key_results',
  'okrs',
  'goal_activities',
  'goals',
  'performance_reviews',
  'performance_plans',
  'performance_cycles',
  'attendance_days',
  'time_log_client_ids',
  'time_logs',
  'nfc_badge_events',
  'nfc_badges',
  'device_tokens',
  'work_zones',
  'leave_balance_ledger',
  'leave_balances',
  'leave_requests',
  'public_holidays',
  'employee_skills',
  'skills',
  'contracts',
  'invitations',
  'employees',
  'departments',
  'notifications',
  'usage_events',
  'usage_counters',
  'files',
  'user_roles',
] as const

/**
 * Kept for accounting and traceability: payments, invoices and the
 * subscriptions they point to, audit logs (24 months, 05 §13) and system logs
 * (30 days, purged on their own).
 */
export const KEPT_TABLES = [
  'payments',
  'invoices',
  'subscriptions',
  'audit_logs',
  'system_logs',
] as const

/** Name left on a purged organization; the real one stays in the audit log. */
export const PURGED_NAME = 'Organisation supprimée'

/** @platformScope — runs in the worker, across organizations. */
export class OrganizationPurgeRepository {
  /** Deleted organizations whose 30 days are over and that are not purged yet. */
  async due(before: Date, limit: number) {
    const rows = await db
      .from('organizations')
      .whereNotNull('deleted_at')
      .whereNull('purged_at')
      .where('deleted_at', '<', before)
      .orderBy('deleted_at')
      .limit(limit)
      .select('id', 'name', 'slug', 'deleted_at')
    return rows as { id: string; name: string; slug: string; deleted_at: Date }[]
  }

  /** Locks the organization if it is still waiting for its purge. */
  lockPending(organizationId: string, before: Date, trx: TransactionClientContract) {
    return trx
      .from('organizations')
      .where('id', organizationId)
      .whereNotNull('deleted_at')
      .whereNull('purged_at')
      .where('deleted_at', '<', before)
      .forUpdate()
      .first()
  }

  /** Deletes the tenant rows; returns the number of rows per table. */
  async deleteTenantRows(organizationId: string, trx: TransactionClientContract) {
    const counts: Record<string, number> = {}
    for (const table of PURGED_TABLES) {
      const result = await trx.rawQuery(`DELETE FROM ${table} WHERE organization_id = ?`, [
        organizationId,
      ])
      const count = Number(result.rowCount ?? 0)
      if (count > 0) counts[table] = count
    }
    return counts
  }

  /** The row stays for payments, invoices and audit logs, without its identity. */
  async anonymize(organizationId: string, at: Date, trx: TransactionClientContract) {
    await trx
      .from('organizations')
      .where('id', organizationId)
      .update({
        name: PURGED_NAME,
        slug: `deleted-${organizationId}`,
        logo_url: null,
        settings: JSON.stringify({}),
        updated_by: null,
        updated_at: at,
        purged_at: at,
      })
  }
}

export default new OrganizationPurgeRepository()
