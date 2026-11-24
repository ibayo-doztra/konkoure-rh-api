import { BaseSchema } from '@adonisjs/lucid/schema'

/** Monthly usage counters: AI credits, active employees, SMS (docs/backend/02 §9, 07 §6.8). */
export default class extends BaseSchema {
  protected tableName = 'usage_counters'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('period').notNullable()
      t.text('metric').notNullable()
      t.integer('used').notNullable().defaultTo(0)
      t.integer('limit_value').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['organization_id', 'period', 'metric'])
    })

    this.schema.raw(`ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check
                     CHECK (metric IN ('ai_credits', 'active_employees', 'sms'))`)
    this.schema.raw(`ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_period_check
                     CHECK (period ~ '^[0-9]{4}-[0-9]{2}$')`)
    this.schema.raw(`ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_used_check
                     CHECK (used >= 0)`)
    this.schema.raw(`CREATE TRIGGER trg_usage_counters_updated BEFORE UPDATE ON usage_counters
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('usage_counters')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
