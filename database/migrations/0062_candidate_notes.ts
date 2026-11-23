import { BaseSchema } from '@adonisjs/lucid/schema'

/** Notes of the recruitment staff on a candidate (docs/backend/02 §7, 07 §4.7). */
export default class extends BaseSchema {
  protected tableName = 'candidate_notes'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('candidate_id')
        .notNullable()
        .references('id')
        .inTable('candidates')
        .onDelete('CASCADE')
      t.uuid('author_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.text('body').notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'candidate_id'])
    })

    this.schema.raw(`CREATE TRIGGER trg_candidate_notes_updated BEFORE UPDATE ON candidate_notes
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('candidate_notes')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
