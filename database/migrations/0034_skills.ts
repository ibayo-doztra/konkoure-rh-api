import { BaseSchema } from '@adonisjs/lucid/schema'

/** Competency catalog of an organization (docs/backend/02 §4). */
export default class extends BaseSchema {
  protected tableName = 'skills'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.text('category').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`CREATE UNIQUE INDEX skills_org_name_uniq
                     ON skills (organization_id, lower(name))`)
    this.schema.raw(`CREATE TRIGGER trg_skills_updated BEFORE UPDATE ON skills
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('skills')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
