import { BaseSchema } from '@adonisjs/lucid/schema'

/** Succession plans of key positions (docs/backend/02 §8), talents module. */
export default class extends BaseSchema {
  protected tableName = 'succession_plans'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('position_title').notNullable()
      t.uuid('current_employee_id')
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')
      t.uuid('successor_employee_id')
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')
      t.text('readiness').nullable()
      t.text('notes').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'created_at'])
      t.index(['current_employee_id'])
      t.index(['successor_employee_id'])
    })

    this.schema.raw(`ALTER TABLE succession_plans ADD CONSTRAINT succession_plans_readiness_check
                     CHECK (readiness IN ('ready_now', '1_2_years', '3_plus_years'))`)
    this.schema.raw(`CREATE TRIGGER trg_succession_plans_updated BEFORE UPDATE ON succession_plans
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('succession_plans')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
