import { BaseSchema } from '@adonisjs/lucid/schema'

/** Employment contracts (docs/backend/02 §4). */
export default class extends BaseSchema {
  protected tableName = 'contracts'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.specificType('type', 'contract_type').notNullable()
      t.specificType('status', 'contract_status').notNullable().defaultTo('draft')
      t.date('start_date').notNullable()
      t.date('end_date').nullable()
      t.date('trial_period_end').nullable()
      t.decimal('salary', 14, 2).nullable()
      t.specificType('currency', 'char(3)').notNullable().defaultTo('GNF')
      t.decimal('weekly_hours', 5, 2).nullable()
      t.text('document_path').nullable()
      t.text('notes').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'employee_id'])
      t.index(['organization_id', 'status'])
    })

    this.schema.raw(`ALTER TABLE contracts ADD CONSTRAINT contracts_dates_check
                     CHECK (end_date IS NULL OR end_date >= start_date)`)
    this.schema.raw(`CREATE UNIQUE INDEX contracts_one_active_per_employee
                     ON contracts (employee_id)
                     WHERE status = 'active' AND deleted_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON contracts
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('contracts')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
