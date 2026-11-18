import { BaseSchema } from '@adonisjs/lucid/schema'

/** Opaque access tokens managed by @adonisjs/auth (docs/backend/02 §3). */
export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.bigIncrements('id')
      t.uuid('tokenable_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.text('type').notNullable()
      // Holds the refresh-token family id, so logout revokes both together.
      t.text('name').nullable()
      t.text('hash').notNullable()
      // Text, not json: @adonisjs/auth stores and parses the JSON string itself.
      t.text('abilities').notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('last_used_at', { useTz: true }).nullable()
      t.timestamp('expires_at', { useTz: true }).nullable()

      t.index(['tokenable_id', 'type'])
      t.index(['hash'])
      t.index(['name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
