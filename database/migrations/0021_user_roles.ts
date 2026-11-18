import { BaseSchema } from '@adonisjs/lucid/schema'

/** Organization membership = holding at least one role (docs/backend/02 §3). */
export default class extends BaseSchema {
  protected tableName = 'user_roles'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.specificType('role', 'app_role').notNullable()
      t.uuid('granted_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['user_id', 'organization_id', 'role'])
      t.index(['organization_id', 'role'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
