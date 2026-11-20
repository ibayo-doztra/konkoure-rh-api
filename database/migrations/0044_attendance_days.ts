import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Daily attendance aggregate (docs/backend/02 §5, 07 §2.8, 09 §3), one row per
 * employee and local day, recomputed from `time_logs` by the attendance jobs.
 * Dashboards and `/org/timeclock/attendance` read it instead of scanning punches.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE attendance_days (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        day date NOT NULL,
        first_in timestamptz NULL,
        last_out timestamptz NULL,
        worked_minutes integer NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
        punch_count integer NOT NULL DEFAULT 0 CHECK (punch_count >= 0),
        is_complete boolean NOT NULL DEFAULT false,
        anomaly text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT attendance_days_employee_day_unique UNIQUE (employee_id, day),
        CONSTRAINT attendance_days_anomaly_check
          CHECK (anomaly IS NULL OR anomaly IN ('missing_out', 'out_of_zone', 'duplicate'))
      )
    `)
    this.schema.raw(
      'CREATE INDEX attendance_days_org_day_idx ON attendance_days (organization_id, day DESC)'
    )
    this.schema.raw(`CREATE TRIGGER trg_attendance_days_updated BEFORE UPDATE ON attendance_days
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('attendance_days')`)
  }

  async down() {
    this.schema.raw('DROP TABLE IF EXISTS attendance_days')
  }
}
