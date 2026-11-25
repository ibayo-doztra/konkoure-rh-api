import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Technical journal (docs/backend/02 §10): job failures, payment discrepancies,
 * integration errors. Outside any tenant, read by the back office. Retention
 * 30 days (`system-logs.purge`).
 */
export default class extends BaseSchema {
  protected tableName = 'system_logs'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.text('channel').notNullable()
      t.text('level').notNullable()
      t.text('message').notNullable()
      t.uuid('organization_id')
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL')
      t.jsonb('context').notNullable().defaultTo('{}')
      t.integer('status_code').nullable()
      t.integer('duration_ms').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['created_at'])
      t.index(['channel', 'level', 'created_at'])
    })
    this.schema.raw(`ALTER TABLE system_logs ADD CONSTRAINT system_logs_level_check
                     CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal'))`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
