import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When the 30-day purge of a deleted organization ran (decision of 2026-11-26):
 * the row stays, anonymized, for its payments, invoices and audit logs.
 */
export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.alterTable(this.tableName, (t) => {
      t.timestamp('purged_at', { useTz: true }).nullable()
    })
    this.schema.raw(`CREATE INDEX organizations_deleted_unpurged_idx ON organizations (deleted_at)
                     WHERE deleted_at IS NOT NULL AND purged_at IS NULL`)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS organizations_deleted_unpurged_idx')
    this.schema.alterTable(this.tableName, (t) => {
      t.dropColumn('purged_at')
    })
  }
}
