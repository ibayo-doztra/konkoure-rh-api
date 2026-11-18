import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Append-only business audit trail, partitioned by month (docs/backend/02 §10,
 * 05 §7). Rows land in the DEFAULT partition until the partition bootstrap
 * (0131) and the monthly job (08 §2) create the monthly partitions.
 * UPDATE/DELETE are revoked from the application role in 0140_grants_roles.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE audit_logs (
        id uuid NOT NULL,
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        actor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        actor_email text NULL,
        actor_role text NULL,
        action text NOT NULL,
        target_type text NULL,
        target_id text NULL,
        before_data jsonb NULL,
        after_data jsonb NULL,
        ip inet NULL,
        user_agent text NULL,
        request_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at)
    `)
    this.schema.raw('CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT')
    this.schema.raw(
      'CREATE INDEX audit_logs_org_created_idx ON audit_logs (organization_id, created_at DESC)'
    )
    this.schema.raw(
      'CREATE INDEX audit_logs_actor_created_idx ON audit_logs (actor_user_id, created_at DESC)'
    )
    this.schema.raw('CREATE INDEX audit_logs_action_idx ON audit_logs (action, created_at DESC)')
  }

  async down() {
    this.schema.raw('DROP TABLE IF EXISTS audit_logs CASCADE')
  }
}
