import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * NFC badges (docs/backend/02 §5, 07 §2.2). Only the peppered hash and the last
 * four characters of the UID are kept (05 §6, decision of 2026-11-19): no
 * readable UID in the database.
 */
export default class extends BaseSchema {
  protected tableName = 'nfc_badges'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.text('uid_hash').notNullable()
      t.text('uid_masked').notNullable()
      t.boolean('is_active').notNullable().defaultTo(true)
      t.timestamp('assigned_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('revoked_at', { useTz: true }).nullable()
      t.uuid('assigned_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'employee_id'])
    })

    // A physical badge is active in a single organization at a time (02 §5).
    this.schema.raw(`CREATE UNIQUE INDEX nfc_badges_active_uid
                     ON nfc_badges (uid_hash) WHERE revoked_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_nfc_badges_updated BEFORE UPDATE ON nfc_badges
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('nfc_badges')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
