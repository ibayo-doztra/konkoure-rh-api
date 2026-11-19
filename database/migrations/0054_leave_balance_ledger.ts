import { BaseSchema } from '@adonisjs/lucid/schema'

/** Immutable journal of every balance movement (docs/backend/02 §6, 03 §7). */
export default class extends BaseSchema {
  protected tableName = 'leave_balance_ledger'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.uuid('leave_request_id')
        .nullable()
        .references('id')
        .inTable('leave_requests')
        .onDelete('SET NULL')
      t.integer('year').notNullable()
      t.specificType('leave_type', 'leave_type').notNullable()
      t.decimal('delta_days', 6, 2).notNullable()
      t.text('reason').notNullable()
      t.uuid('actor_user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['employee_id', 'year', 'leave_type'])
      t.index(['organization_id', 'created_at'])
    })

    // Insert only for the application roles: see 0115, which runs after the grants of 0114.
    this.schema.raw(`SELECT enable_tenant_rls('leave_balance_ledger')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
