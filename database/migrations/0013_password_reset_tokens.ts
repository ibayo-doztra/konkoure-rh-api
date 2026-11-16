import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-use password reset tokens: only the SHA-256 hash is stored, TTL 1 h
 * (docs/backend/04 §3). Documented in 02 §3 alongside this migration.
 */
export default class extends BaseSchema {
  protected tableName = 'password_reset_tokens'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.text('token_hash').notNullable().unique()
      t.timestamp('expires_at', { useTz: true }).notNullable()
      t.timestamp('used_at', { useTz: true }).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['user_id'])
      t.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
