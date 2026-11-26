import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Indexes of the read paths that had none (docs/backend/03 §2, 09 §3). The
 * indexes of 02 (trigram on employee names, GiST exclusion of leaves, partial
 * uniques) already live in their table's migration; these back the searches
 * and the scheduled jobs:
 * - trigram: `LIKE '%…%'` searches of the back office (accounts, organizations)
 *   and of the candidates;
 * - partial: anomalies of punches and days (dashboard, `/attendance` filter),
 *   offers to auto-close, active contracts by end date (`contracts:expiring`).
 */
const INDEXES: Array<[name: string, definition: string]> = [
  ['users_email_trgm_idx', 'users USING gin (lower(email::text) gin_trgm_ops)'],
  ['users_full_name_trgm_idx', 'users USING gin (lower(full_name) gin_trgm_ops)'],
  ['organizations_name_trgm_idx', 'organizations USING gin (lower(name) gin_trgm_ops)'],
  ['candidates_full_name_trgm_idx', 'candidates USING gin (lower(full_name) gin_trgm_ops)'],
  ['candidates_email_trgm_idx', 'candidates USING gin (lower(email::text) gin_trgm_ops)'],
  [
    'time_logs_org_anomaly_idx',
    'time_logs (organization_id, punched_at) WHERE anomaly IS NOT NULL',
  ],
  [
    'attendance_days_org_anomaly_idx',
    'attendance_days (organization_id, anomaly, day DESC) WHERE anomaly IS NOT NULL',
  ],
  [
    'jobs_published_deadline_idx',
    "jobs (deadline) WHERE status = 'published' AND deadline IS NOT NULL",
  ],
  [
    'contracts_active_end_idx',
    "contracts (end_date) WHERE status = 'active' AND deleted_at IS NULL AND end_date IS NOT NULL",
  ],
]

export default class extends BaseSchema {
  async up() {
    for (const [name, definition] of INDEXES) {
      this.schema.raw(`CREATE INDEX IF NOT EXISTS ${name} ON ${definition}`)
    }
  }

  async down() {
    for (const [name] of [...INDEXES].reverse()) {
      this.schema.raw(`DROP INDEX IF EXISTS ${name}`)
    }
  }
}
