import { BaseSchema } from '@adonisjs/lucid/schema'

/** Evaluation cycles of an organization (docs/backend/02 §8, 06 §9). */
export default class extends BaseSchema {
  protected tableName = 'performance_cycles'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.specificType('frequency', 'perf_cycle_frequency').notNullable()
      t.date('period_start').notNullable()
      t.date('period_end').notNullable()
      t.timestamp('self_eval_opens_at', { useTz: true }).nullable()
      t.timestamp('self_eval_closes_at', { useTz: true }).nullable()
      t.specificType('status', 'perf_cycle_status').notNullable().defaultTo('draft')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'status'])
    })

    this.schema.raw(`ALTER TABLE performance_cycles ADD CONSTRAINT performance_cycles_period_check
                     CHECK (period_end >= period_start)`)
    this.schema.raw(`ALTER TABLE performance_cycles
                     ADD CONSTRAINT performance_cycles_self_eval_check
                     CHECK (self_eval_closes_at IS NULL OR self_eval_opens_at IS NULL
                            OR self_eval_closes_at >= self_eval_opens_at)`)
    this.schema.raw(`CREATE TRIGGER trg_performance_cycles_updated
                     BEFORE UPDATE ON performance_cycles
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('performance_cycles')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
