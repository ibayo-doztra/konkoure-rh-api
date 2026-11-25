import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Platform settings (docs/backend/02 §10), outside any tenant. The known keys
 * are inserted here with their default (reference data, 03 §1):
 * `modules_open_for_testing` opens every module to every organization and
 * stays off until a root turns it on.
 */
export default class extends BaseSchema {
  protected tableName = 'platform_settings'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.text('key').primary()
      t.jsonb('value').notNullable()
      t.text('description').nullable()
      t.boolean('is_secret').notNullable().defaultTo(false)
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(`CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON platform_settings
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)

    this.defer(async (db) => {
      await db.table(this.tableName).insert({
        key: 'modules_open_for_testing',
        value: JSON.stringify(false),
        description:
          'Ouvre tous les modules à toutes les organisations (tests, avant le lancement).',
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
