import { BaseSchema } from '@adonisjs/lucid/schema'

/** Continuous feedback (docs/backend/02 §8, 07 §5.9). */
export default class extends BaseSchema {
  protected tableName = 'feedbacks'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('from_employee_id')
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')
      t.uuid('to_employee_id')
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')
      t.specificType('kind', 'feedback_kind').notNullable()
      t.text('message').notNullable()
      t.uuid('okr_id').nullable().references('id').inTable('okrs').onDelete('SET NULL')
      t.uuid('goal_id').nullable().references('id').inTable('goals').onDelete('SET NULL')
      t.boolean('is_private').notNullable().defaultTo(false)
      t.boolean('visible_to_manager').notNullable().defaultTo(true)
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'to_employee_id', 'created_at'])
      t.index(['organization_id', 'from_employee_id'])
      t.index(['created_by'])
    })

    this.schema.raw(`CREATE TRIGGER trg_feedbacks_updated BEFORE UPDATE ON feedbacks
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('feedbacks')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
