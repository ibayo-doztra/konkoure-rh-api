import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Usage journal (docs/backend/02 §7, 08 §7): written asynchronously by the
 * `usage.record` job, never blocking; insert only. Retention 12 months (05 §13).
 */
export default class extends BaseSchema {
  protected tableName = 'usage_events'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.text('kind').notNullable()
      t.text('module').nullable()
      t.text('path').nullable()
      t.jsonb('metadata').notNullable().defaultTo('{}')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'created_at'])
    })

    this.schema.raw(`SELECT enable_tenant_rls('usage_events')`)
    this.schema.raw(`REVOKE UPDATE, DELETE ON usage_events FROM konkoure_app, konkoure_worker`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
