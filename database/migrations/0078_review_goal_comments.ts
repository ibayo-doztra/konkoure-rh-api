import { BaseSchema } from '@adonisjs/lucid/schema'

/** Self and manager comments on each goal of an evaluation (docs/backend/02 §8). */
export default class extends BaseSchema {
  protected tableName = 'review_goal_comments'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('review_id')
        .notNullable()
        .references('id')
        .inTable('performance_reviews')
        .onDelete('CASCADE')
      t.uuid('goal_id').notNullable().references('id').inTable('goals').onDelete('CASCADE')
      t.text('self_comment').nullable()
      t.smallint('self_rating').nullable()
      t.text('manager_comment').nullable()
      t.smallint('manager_rating').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['review_id', 'goal_id'])
      t.index(['organization_id', 'review_id'])
      t.index(['goal_id'])
    })

    this.schema
      .raw(`ALTER TABLE review_goal_comments ADD CONSTRAINT review_goal_comments_ratings_check
                     CHECK ((self_rating IS NULL OR self_rating BETWEEN 1 AND 5)
                        AND (manager_rating IS NULL OR manager_rating BETWEEN 1 AND 5))`)
    this.schema.raw(`CREATE TRIGGER trg_review_goal_comments_updated
                     BEFORE UPDATE ON review_goal_comments
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('review_goal_comments')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
