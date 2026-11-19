import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `leave_balance_ledger` is insert only for the application roles (docs/backend/03 §8).
 * Numbered after 0114, whose `GRANT … ON ALL TABLES` would otherwise give
 * UPDATE and DELETE back on a database migrated from scratch.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      REVOKE UPDATE, DELETE ON leave_balance_ledger FROM konkoure_app, konkoure_worker
    `)
  }

  async down() {
    this.schema.raw(`
      GRANT UPDATE, DELETE ON leave_balance_ledger TO konkoure_app, konkoure_worker
    `)
  }
}
