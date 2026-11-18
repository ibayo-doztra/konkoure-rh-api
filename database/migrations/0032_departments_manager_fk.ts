import { BaseSchema } from '@adonisjs/lucid/schema'

/** Foreign keys that had to wait for `employees` (docs/backend/03 §1). */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('departments', (t) => {
      t.foreign('manager_id').references('id').inTable('employees').onDelete('SET NULL')
    })
    this.schema.alterTable('invitations', (t) => {
      t.foreign('employee_id').references('id').inTable('employees').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('invitations', (t) => {
      t.dropForeign('employee_id')
    })
    this.schema.alterTable('departments', (t) => {
      t.dropForeign('manager_id')
    })
  }
}
