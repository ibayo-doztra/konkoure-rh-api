import { BaseSchema } from '@adonisjs/lucid/schema'

/** Progress points of an OKR (docs/backend/02 §8, 07 §5.5). */
export default class extends BaseSchema {
  protected tableName = 'okr_checkins'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('okr_id').notNullable().references('id').inTable('okrs').onDelete('CASCADE')
      t.uuid('author_employee_id')
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')
      t.text('message').notNullable()
      t.smallint('progress_snapshot').notNullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'okr_id', 'created_at'])
    })

    this.schema.raw(`CREATE TRIGGER trg_okr_checkins_updated BEFORE UPDATE ON okr_checkins
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('okr_checkins')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
