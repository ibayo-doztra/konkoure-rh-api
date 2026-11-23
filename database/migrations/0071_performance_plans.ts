import { BaseSchema } from '@adonisjs/lucid/schema'

/** Goal plans of an organization (docs/backend/02 §8, 06 §9). */
export default class extends BaseSchema {
  protected tableName = 'performance_plans'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.date('period_start').notNullable()
      t.date('period_end').notNullable()
      t.specificType('status', 'perf_plan_status').notNullable().defaultTo('draft')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'status'])
    })

    this.schema.raw(`ALTER TABLE performance_plans ADD CONSTRAINT performance_plans_period_check
                     CHECK (period_end >= period_start)`)
    this.schema.raw(`CREATE TRIGGER trg_performance_plans_updated
                     BEFORE UPDATE ON performance_plans
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('performance_plans')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
