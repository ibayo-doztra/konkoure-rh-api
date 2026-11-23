import { BaseSchema } from '@adonisjs/lucid/schema'

/** Achievements of an employee (docs/backend/02 §8). */
export default class extends BaseSchema {
  protected tableName = 'achievements'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').nullable().references('id').inTable('employees').onDelete('CASCADE')
      t.uuid('goal_id').nullable().references('id').inTable('goals').onDelete('SET NULL')
      t.text('title').notNullable()
      t.text('description').nullable()
      t.text('impact').nullable()
      t.timestamp('achieved_at', { useTz: true }).notNullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'employee_id', 'achieved_at'])
      t.index(['goal_id'])
    })

    this.schema.raw(`CREATE TRIGGER trg_achievements_updated BEFORE UPDATE ON achievements
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('achievements')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
