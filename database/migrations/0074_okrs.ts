import { BaseSchema } from '@adonisjs/lucid/schema'

/** OKR objectives (docs/backend/02 §8, 07 §5.3). */
export default class extends BaseSchema {
  protected tableName = 'okrs'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').nullable().references('id').inTable('employees').onDelete('CASCADE')
      t.text('quarter').notNullable()
      t.text('objective').notNullable()
      t.specificType('status', 'okr_status').notNullable().defaultTo('draft')
      t.specificType('review_status', 'okr_review_status').notNullable().defaultTo('draft')
      t.smallint('progress').notNullable().defaultTo(0)
      t.timestamp('submitted_at', { useTz: true }).nullable()
      t.timestamp('validated_at', { useTz: true }).nullable()
      t.uuid('validated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.text('manager_comment').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      // docs/backend/09: (organization_id, employee_id, quarter).
      t.index(['organization_id', 'employee_id', 'quarter'])
      t.index(['organization_id', 'review_status'])
    })

    this.schema.raw(`ALTER TABLE okrs ADD CONSTRAINT okrs_quarter_check
                     CHECK (quarter ~ '^[0-9]{4}-Q[1-4]$')`)
    this.schema.raw(`ALTER TABLE okrs ADD CONSTRAINT okrs_progress_check
                     CHECK (progress BETWEEN 0 AND 100)`)
    this.schema.raw(`CREATE TRIGGER trg_okrs_updated BEFORE UPDATE ON okrs
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('okrs')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
