import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `usage_events` partitioned by month on `created_at` (docs/backend/09 §4,
 * decision of 2026-11-26), like `time_logs` and `audit_logs`. In one
 * transaction: the table is renamed, the partitioned one created (DEFAULT plus
 * the 12 months to come), the rows copied, the old table dropped. A
 * partitioned table's primary key must hold the partition key: `(id, created_at)`.
 * RLS, insert-only grants and the read-only role are set again.
 */
const COLUMNS = 'id, organization_id, user_id, kind, module, path, metadata, created_at'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE usage_events RENAME TO usage_events_old')
    this.schema.raw(`
      CREATE TABLE usage_events (
        id uuid NOT NULL,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        kind text NOT NULL,
        module text NULL,
        path text NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at)
    `)
    this.schema.raw('CREATE TABLE usage_events_default PARTITION OF usage_events DEFAULT')
    this.schema.raw(`
      DO $$
      DECLARE month date := date_trunc('month', now())::date;
      BEGIN
        FOR step IN 0..11 LOOP
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF usage_events FOR VALUES FROM (%L) TO (%L)',
            'usage_events_' || to_char(month + make_interval(months => step), 'YYYY_MM'),
            month + make_interval(months => step),
            month + make_interval(months => step + 1)
          );
        END LOOP;
      END $$;
    `)
    this.schema.raw(`INSERT INTO usage_events (${COLUMNS}) SELECT ${COLUMNS} FROM usage_events_old`)
    this.schema.raw('DROP TABLE usage_events_old')
    this.schema.raw(
      'CREATE INDEX usage_events_org_created_idx ON usage_events (organization_id, created_at)'
    )
    this.schema.raw(`SELECT enable_tenant_rls('usage_events')`)
    this.schema.raw('GRANT SELECT, INSERT ON usage_events TO konkoure_app, konkoure_worker')
    this.schema.raw('REVOKE UPDATE, DELETE ON usage_events FROM konkoure_app, konkoure_worker')
    this.schema.raw('GRANT SELECT ON usage_events TO konkoure_readonly')
  }

  /** Back to a plain table, rows kept. */
  async down() {
    this.schema.raw('ALTER TABLE usage_events RENAME TO usage_events_partitioned')
    this.schema.raw(`
      CREATE TABLE usage_events (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        kind text NOT NULL,
        module text NULL,
        path text NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    this.schema.raw(
      `INSERT INTO usage_events (${COLUMNS}) SELECT ${COLUMNS} FROM usage_events_partitioned`
    )
    this.schema.raw('DROP TABLE usage_events_partitioned')
    this.schema.raw(
      'CREATE INDEX usage_events_organization_id_created_at_index ON usage_events (organization_id, created_at)'
    )
    this.schema.raw(`SELECT enable_tenant_rls('usage_events')`)
    this.schema.raw('GRANT SELECT, INSERT ON usage_events TO konkoure_app, konkoure_worker')
    this.schema.raw('REVOKE UPDATE, DELETE ON usage_events FROM konkoure_app, konkoure_worker')
    this.schema.raw('GRANT SELECT ON usage_events TO konkoure_readonly')
  }
}
