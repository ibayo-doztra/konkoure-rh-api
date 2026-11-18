import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Employee records (docs/backend/02 §4, 03 §3). The name search index of
 * 09 §3 is created here: the search ships with the table.
 */
export default class extends BaseSchema {
  protected tableName = 'employees'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.text('employee_number').nullable()
      t.text('first_name').notNullable()
      t.text('last_name').notNullable()
      t.specificType('email', 'citext').nullable()
      t.text('phone').nullable()
      t.text('photo_url').nullable()
      t.text('job_title').nullable()
      t.uuid('department_id')
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
      t.uuid('manager_id').nullable().references('id').inTable('employees').onDelete('SET NULL')
      t.date('hire_date').nullable()
      t.date('end_date').nullable()
      t.specificType('status', 'employee_status').notNullable().defaultTo('active')
      t.decimal('base_salary', 14, 2).nullable()
      t.specificType('salary_currency', 'char(3)').nullable()
      t.decimal('leave_balance', 6, 2).notNullable().defaultTo(0)
      t.date('birth_date').nullable()
      t.text('gender').nullable()
      t.text('national_id').nullable()
      t.text('passport_document_path').nullable()
      t.jsonb('address').notNullable().defaultTo('{}')
      t.jsonb('emergency_contact').notNullable().defaultTo('{}')
      t.jsonb('profile_details').notNullable().defaultTo('{}')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.unique(['organization_id', 'employee_number'])
      t.index(['organization_id', 'department_id'])
      t.index(['organization_id', 'manager_id'])
    })

    this.schema.raw(`ALTER TABLE employees ADD CONSTRAINT employees_manager_not_self
                     CHECK (manager_id IS NULL OR manager_id <> id)`)
    this.schema.raw(`CREATE INDEX employees_org_status_idx ON employees (organization_id, status)
                     WHERE deleted_at IS NULL`)
    this.schema.raw(`CREATE INDEX employees_name_trgm ON employees
                     USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops)`)
    this.schema.raw(`CREATE UNIQUE INDEX employees_org_email_uniq
                     ON employees (organization_id, lower(email::text))
                     WHERE email IS NOT NULL AND deleted_at IS NULL`)
    this.schema.raw(`CREATE UNIQUE INDEX employees_org_user_uniq
                     ON employees (organization_id, user_id)
                     WHERE user_id IS NOT NULL AND deleted_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('employees')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
