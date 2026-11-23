import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Goals (docs/backend/02 §8, 07 §5.2). `review_id` gets its foreign key with
 * `performance_reviews`.
 */
export default class extends BaseSchema {
  protected tableName = 'goals'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('plan_id')
        .nullable()
        .references('id')
        .inTable('performance_plans')
        .onDelete('SET NULL')
      t.uuid('review_id').nullable()
      t.uuid('employee_id').nullable().references('id').inTable('employees').onDelete('CASCADE')
      t.uuid('owner_id').nullable().references('id').inTable('employees').onDelete('SET NULL')
      t.uuid('parent_goal_id').nullable().references('id').inTable('goals').onDelete('SET NULL')
      t.text('title').notNullable()
      t.text('description').nullable()
      t.text('measurement').nullable()
      t.specificType('category', 'goal_category').notNullable().defaultTo('business')
      t.smallint('weight').notNullable().defaultTo(0)
      t.smallint('progress').notNullable().defaultTo(0)
      t.specificType('status', 'goal_status').notNullable().defaultTo('not_started')
      t.date('start_date').nullable()
      t.date('due_date').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'employee_id'])
      t.index(['organization_id', 'status'])
      t.index(['plan_id', 'employee_id'])
      t.index(['parent_goal_id'])
      t.index(['owner_id'])
    })

    this.schema.raw(`ALTER TABLE goals ADD CONSTRAINT goals_weight_check
                     CHECK (weight BETWEEN 0 AND 100)`)
    this.schema.raw(`ALTER TABLE goals ADD CONSTRAINT goals_progress_check
                     CHECK (progress BETWEEN 0 AND 100)`)
    this.schema.raw(`ALTER TABLE goals ADD CONSTRAINT goals_dates_check
                     CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)`)
    this.schema.raw(`ALTER TABLE goals ADD CONSTRAINT goals_parent_check
                     CHECK (parent_goal_id IS NULL OR parent_goal_id <> id)`)
    this.schema.raw(`CREATE INDEX goals_due_open_idx ON goals (due_date)
                     WHERE status IN ('not_started', 'in_progress') AND deleted_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON goals
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('goals')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
