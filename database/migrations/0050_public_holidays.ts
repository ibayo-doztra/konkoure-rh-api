import { BaseSchema } from '@adonisjs/lucid/schema'

/** Public holidays of each organization (docs/backend/02 §6, 07 §9). */
export default class extends BaseSchema {
  protected tableName = 'public_holidays'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.date('date').notNullable()
      t.boolean('is_movable').notNullable().defaultTo(false)
      t.boolean('is_recurring').notNullable().defaultTo(false)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['organization_id', 'date'])
    })

    this.schema.raw(`CREATE TRIGGER trg_public_holidays_updated BEFORE UPDATE ON public_holidays
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('public_holidays')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
