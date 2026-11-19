import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Leave balances per employee, year and type (docs/backend/02 §6). Displayed
 * balance = entitled + carried_over − taken − pending; it only moves together
 * with a `leave_balance_ledger` row (07 §3.6).
 */
export default class extends BaseSchema {
  protected tableName = 'leave_balances'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.integer('year').notNullable()
      t.specificType('leave_type', 'leave_type').notNullable()
      t.decimal('entitled_days', 6, 2).notNullable().defaultTo(0)
      t.decimal('carried_over_days', 6, 2).notNullable().defaultTo(0)
      t.decimal('taken_days', 6, 2).notNullable().defaultTo(0)
      t.decimal('pending_days', 6, 2).notNullable().defaultTo(0)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['employee_id', 'year', 'leave_type'])
      t.index(['organization_id', 'year'])
    })

    this.schema.raw(`CREATE TRIGGER trg_leave_balances_updated BEFORE UPDATE ON leave_balances
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('leave_balances')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
