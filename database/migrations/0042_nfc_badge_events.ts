import { BaseSchema } from '@adonisjs/lucid/schema'

/** Journal of badge assignments, revocations and rejected scans (02 §5). Insert only (0116). */
export default class extends BaseSchema {
  protected tableName = 'nfc_badge_events'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL')
      t.uuid('badge_id').nullable().references('id').inTable('nfc_badges').onDelete('SET NULL')
      t.text('uid_masked').notNullable()
      t.text('event').notNullable()
      t.text('reason').nullable()
      t.uuid('actor_user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.specificType('ip', 'inet').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'created_at'])
    })

    this.schema.raw(`ALTER TABLE nfc_badge_events ADD CONSTRAINT nfc_badge_events_event_check
                     CHECK (event IN ('assigned', 'revoked', 'reassigned', 'scan_rejected'))`)
    this.schema.raw(`SELECT enable_tenant_rls('nfc_badge_events')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
