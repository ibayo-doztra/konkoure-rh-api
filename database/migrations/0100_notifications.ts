import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * In-app notifications (docs/backend/02 §10, 07 §8), written by the API only
 * from business events. Kept 180 days (`notifications.purge`).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL,
        title text NOT NULL,
        body text NULL,
        link text NULL,
        payload jsonb NOT NULL DEFAULT '{}',
        read_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    this.schema.raw(`CREATE INDEX notifications_user_read_created_idx
                     ON notifications (user_id, read_at, created_at DESC)`)
    this.schema.raw(`CREATE INDEX notifications_user_unread_idx
                     ON notifications (user_id, created_at DESC) WHERE read_at IS NULL`)
    this.schema.raw('CREATE INDEX notifications_created_idx ON notifications (created_at)')
    this.schema.raw(`SELECT enable_tenant_rls('notifications')`)
  }

  async down() {
    this.schema.raw('DROP TABLE IF EXISTS notifications')
  }
}
