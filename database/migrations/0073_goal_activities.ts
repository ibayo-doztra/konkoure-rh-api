import { BaseSchema } from '@adonisjs/lucid/schema'

/** Activities planned to reach a goal (docs/backend/02 §8). */
export default class extends BaseSchema {
  protected tableName = 'goal_activities'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('goal_id').notNullable().references('id').inTable('goals').onDelete('CASCADE')
      t.uuid('employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL')
      t.text('title').notNullable()
      t.text('description').nullable()
      t.specificType('status', 'goal_activity_status').notNullable().defaultTo('planned')
      t.date('planned_date').nullable()
      t.timestamp('completed_at', { useTz: true }).nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'goal_id'])
      t.index(['employee_id'])
    })

    this.schema.raw(`CREATE TRIGGER trg_goal_activities_updated BEFORE UPDATE ON goal_activities
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('goal_activities')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
