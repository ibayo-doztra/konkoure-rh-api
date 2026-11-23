import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Inbound webhook journal (docs/backend/02 §11, 05 §11): one row per event,
 * `UNIQUE(provider, event_id)` stops replays. Not tenant data.
 */
export default class extends BaseSchema {
  protected tableName = 'webhook_receipts'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.text('provider').notNullable()
      t.text('event_id').notNullable()
      t.boolean('signature_valid').notNullable()
      t.jsonb('payload').notNullable()
      t.timestamp('processed_at', { useTz: true }).nullable()
      t.text('error').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['provider', 'event_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
