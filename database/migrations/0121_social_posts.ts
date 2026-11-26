import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Publications of a job offer on a social account (02 §10, 08 §8):
 * `pending → published | failed`, sent by the `outbound` queue.
 */
export default class extends BaseSchema {
  protected tableName = 'social_posts'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('job_id').notNullable().references('id').inTable('jobs').onDelete('CASCADE')
      t.uuid('social_account_id')
        .nullable()
        .references('id')
        .inTable('social_accounts')
        .onDelete('SET NULL')
      t.specificType('provider', 'social_provider').notNullable()
      t.text('content').notNullable()
      t.jsonb('media_urls').notNullable().defaultTo('[]')
      t.specificType('status', 'social_post_status').notNullable().defaultTo('pending')
      t.text('external_post_id').nullable()
      t.text('external_url').nullable()
      t.text('error_message').nullable()
      t.timestamp('published_at', { useTz: true }).nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'job_id', 'created_at'])
    })
    this.schema.raw(`CREATE TRIGGER trg_social_posts_updated
                     BEFORE UPDATE ON social_posts
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('social_posts')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
