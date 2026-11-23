import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Job offers (docs/backend/02 §7, 07 §4.1). `required_documents` lists the
 * extra pieces of an application: `[{ key, label, required }]`.
 */
export default class extends BaseSchema {
  protected tableName = 'jobs'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('title').notNullable()
      t.text('slug').notNullable()
      t.uuid('department_id')
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
      t.text('location').nullable()
      t.specificType('contract_type', 'contract_type').notNullable()
      t.text('description').nullable()
      t.text('requirements').nullable()
      t.specificType('status', 'job_status').notNullable().defaultTo('draft')
      t.timestamp('published_at', { useTz: true }).nullable()
      t.timestamp('deadline', { useTz: true }).nullable()
      t.jsonb('required_documents').notNullable().defaultTo('[]')
      t.smallint('inclusive_score').nullable()
      t.integer('views_count').notNullable().defaultTo(0)
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['department_id'])
    })

    // The slug stays unique even among deleted offers: public links never point elsewhere.
    this.schema.raw('CREATE UNIQUE INDEX jobs_org_slug_uniq ON jobs (organization_id, slug)')
    this.schema.raw(`CREATE INDEX jobs_org_status_published_idx
                     ON jobs (organization_id, status, published_at DESC)`)
    this.schema.raw(`ALTER TABLE jobs ADD CONSTRAINT jobs_inclusive_score_check
                     CHECK (inclusive_score IS NULL OR inclusive_score BETWEEN 0 AND 100)`)
    this.schema.raw(`CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('jobs')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
