import { BaseSchema } from '@adonisjs/lucid/schema'

/** Rotating refresh tokens, grouped by family (docs/backend/02 §3, 04 §1). */
export default class extends BaseSchema {
  protected tableName = 'auth_refresh_tokens'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.text('token_hash').notNullable().unique()
      t.uuid('family_id').notNullable()
      t.uuid('parent_id')
        .nullable()
        .references('id')
        .inTable('auth_refresh_tokens')
        .onDelete('SET NULL')
      t.text('device_label').nullable()
      t.specificType('ip', 'inet').nullable()
      t.text('user_agent').nullable()
      t.timestamp('expires_at', { useTz: true }).notNullable()
      t.timestamp('revoked_at', { useTz: true }).nullable()
      t.timestamp('replaced_at', { useTz: true }).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['user_id', 'revoked_at'])
      t.index(['family_id'])
      t.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
