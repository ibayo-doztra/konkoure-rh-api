import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Evaluations (docs/backend/02 §8, 07 §5.7), and the foreign key of
 * `goals.review_id` left pending by 0072.
 */
export default class extends BaseSchema {
  protected tableName = 'performance_reviews'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('cycle_id')
        .nullable()
        .references('id')
        .inTable('performance_cycles')
        .onDelete('SET NULL')
      t.uuid('plan_id')
        .nullable()
        .references('id')
        .inTable('performance_plans')
        .onDelete('SET NULL')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.uuid('manager_id').nullable().references('id').inTable('employees').onDelete('SET NULL')
      t.specificType('status', 'perf_review_status').notNullable().defaultTo('not_started')
      t.smallint('self_score').nullable()
      t.text('self_global_comment').nullable()
      t.timestamp('submitted_at', { useTz: true }).nullable()
      t.smallint('manager_score').nullable()
      t.text('manager_global_comment').nullable()
      t.timestamp('manager_submitted_at', { useTz: true }).nullable()
      t.timestamp('sent_back_at', { useTz: true }).nullable()
      t.text('sent_back_comment').nullable()
      t.timestamp('validated_at', { useTz: true }).nullable()
      t.uuid('validated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('signed_at', { useTz: true }).nullable()
      t.uuid('signed_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.smallint('performance_score').nullable()
      t.smallint('potential_score').nullable()
      t.text('ai_summary').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'employee_id'])
      t.index(['organization_id', 'status'])
      t.index(['cycle_id'])
      t.index(['manager_id'])
    })

    this.schema.raw(`ALTER TABLE performance_reviews ADD CONSTRAINT performance_reviews_scores_check
                     CHECK ((self_score IS NULL OR self_score BETWEEN 1 AND 5)
                        AND (manager_score IS NULL OR manager_score BETWEEN 1 AND 5))`)
    this.schema.raw(`CREATE UNIQUE INDEX performance_reviews_cycle_employee_uniq
                     ON performance_reviews (cycle_id, employee_id) WHERE cycle_id IS NOT NULL`)
    this.schema.raw(`CREATE TRIGGER trg_performance_reviews_updated
                     BEFORE UPDATE ON performance_reviews
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('performance_reviews')`)

    this.schema.raw(`ALTER TABLE goals ADD CONSTRAINT goals_review_id_foreign
                     FOREIGN KEY (review_id) REFERENCES performance_reviews (id) ON DELETE SET NULL`)
    this.schema.raw('CREATE INDEX goals_review_id_index ON goals (review_id)')
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS goals_review_id_index')
    this.schema.raw('ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_review_id_foreign')
    this.schema.dropTable(this.tableName)
  }
}
