import { BaseSchema } from '@adonisjs/lucid/schema'

/** Tenant root (docs/backend/02 §3). */
export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.text('name').notNullable()
      t.text('slug').notNullable().unique()
      t.text('logo_url').nullable()
      t.specificType('country_code', 'char(2)').notNullable().defaultTo('GN')
      t.text('timezone').notNullable().defaultTo('Africa/Conakry')
      t.text('default_language').notNullable().defaultTo('fr')
      t.specificType('default_currency', 'char(3)').notNullable().defaultTo('GNF')
      t.specificType('performance_model', 'performance_model').notNullable().defaultTo('sap')
      t.jsonb('settings').notNullable().defaultTo('{}')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()
    })

    this.schema.raw(`CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
