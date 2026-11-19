import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Punches (docs/backend/02 §5), partitioned by month on `punched_at` (09 §4).
 * A unique key on a partitioned table must contain `punched_at`, so the
 * offline idempotency of 07 §2.5 lives in `time_log_client_ids`. `anomaly`
 * keeps `out_of_zone`, `low_accuracy` or `clock_drift` (07 §2.6–2.7).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE time_logs (
        id uuid NOT NULL,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        type punch_type NOT NULL,
        punched_at timestamptz NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        source punch_source NOT NULL,
        work_zone_id uuid NULL REFERENCES work_zones(id) ON DELETE SET NULL,
        latitude double precision NULL,
        longitude double precision NULL,
        accuracy_meters numeric(7,2) NULL,
        distance_meters numeric(9,2) NULL,
        is_within_zone boolean NOT NULL DEFAULT false,
        anomaly text NULL,
        device_id text NULL,
        client_punch_id uuid NULL,
        notes text NULL,
        created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id, punched_at),
        CONSTRAINT time_logs_anomaly_check
          CHECK (anomaly IS NULL OR anomaly IN ('out_of_zone', 'low_accuracy', 'clock_drift'))
      ) PARTITION BY RANGE (punched_at)
    `)
    this.schema.raw('CREATE TABLE time_logs_default PARTITION OF time_logs DEFAULT')
    // The current month and the next three; `partitions:ensure` keeps the lead.
    this.schema.raw(`
      DO $$
      DECLARE month date := date_trunc('month', now())::date;
      BEGIN
        FOR step IN 0..3 LOOP
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF time_logs FOR VALUES FROM (%L) TO (%L)',
            'time_logs_' || to_char(month + make_interval(months => step), 'YYYY_MM'),
            month + make_interval(months => step),
            month + make_interval(months => step + 1)
          );
        END LOOP;
      END $$;
    `)
    this.schema.raw(
      'CREATE INDEX time_logs_org_punched_idx ON time_logs (organization_id, punched_at DESC)'
    )
    this.schema.raw(
      'CREATE INDEX time_logs_employee_punched_idx ON time_logs (employee_id, punched_at DESC)'
    )
    this.schema.raw(`CREATE TRIGGER trg_time_logs_updated BEFORE UPDATE ON time_logs
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('time_logs')`)

    this.schema.raw(`
      CREATE TABLE time_log_client_ids (
        employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        client_punch_id uuid NOT NULL,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        time_log_id uuid NOT NULL,
        punched_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (employee_id, client_punch_id)
      )
    `)
    this.schema.raw(`SELECT enable_tenant_rls('time_log_client_ids')`)
  }

  async down() {
    this.schema.raw('DROP TABLE IF EXISTS time_log_client_ids')
    this.schema.raw('DROP TABLE IF EXISTS time_logs CASCADE')
  }
}
