import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Plan change scheduled at the end of the period: a downgrade takes effect at
 * the term (07 §6.7, decision of 2026-11-24).
 */
export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.alterTable(this.tableName, (t) => {
      t.uuid('scheduled_plan_id').nullable().references('id').inTable('plans').onDelete('RESTRICT')
      t.specificType('scheduled_cycle', 'billing_cycle').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (t) => {
      t.dropColumn('scheduled_plan_id')
      t.dropColumn('scheduled_cycle')
    })
  }
}
