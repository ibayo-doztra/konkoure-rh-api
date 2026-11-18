import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Organization invitations (docs/backend/02 §3, 04 §3). Only the SHA-256 of
 * the 32-byte token is stored. `employee_id` gets its foreign key with the
 * employees table (HR module), like the departments/employees circular FK.
 * At most one pending invitation per (organization, e-mail).
 */
export default class extends BaseSchema {
  protected tableName = 'invitations'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.specificType('email', 'citext').notNullable()
      t.specificType('role', 'app_role').notNullable()
      t.uuid('employee_id').nullable()
      t.text('token_hash').notNullable().unique()
      t.specificType('status', 'invitation_status').notNullable().defaultTo('pending')
      t.timestamp('expires_at', { useTz: true }).notNullable()
      t.timestamp('accepted_at', { useTz: true }).nullable()
      t.uuid('accepted_user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('invited_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.integer('send_count').notNullable().defaultTo(1)
      t.timestamp('last_sent_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'status', 'created_at'])
    })

    this.schema.raw(`CREATE UNIQUE INDEX invitations_one_pending_per_email
                     ON invitations (organization_id, email) WHERE status = 'pending'`)
    this.schema.raw(`CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON invitations
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
