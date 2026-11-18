import { BaseSchema } from '@adonisjs/lucid/schema'

/** Back-office administrators, outside any tenant (docs/backend/02 §10, 04 §4). */
export default class extends BaseSchema {
  protected tableName = 'platform_admins'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE')
      t.specificType('level', 'platform_admin_level').notNullable().defaultTo('support')
      t.boolean('is_active').notNullable().defaultTo(true)
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`CREATE TRIGGER trg_platform_admins_updated BEFORE UPDATE ON platform_admins
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
