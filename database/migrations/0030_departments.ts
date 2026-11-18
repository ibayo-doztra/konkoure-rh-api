import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Departments (docs/backend/02 §4). `manager_id` gets its foreign key in 0032,
 * once `employees` exists.
 */
export default class extends BaseSchema {
  protected tableName = 'departments'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.text('description').nullable()
      t.uuid('manager_id').nullable()
      t.uuid('parent_department_id')
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'parent_department_id'])
      t.index(['organization_id', 'manager_id'])
    })

    this.schema.raw(`ALTER TABLE departments ADD CONSTRAINT departments_parent_not_self
                     CHECK (parent_department_id IS NULL OR parent_department_id <> id)`)
    this.schema.raw(`CREATE UNIQUE INDEX departments_org_name_uniq
                     ON departments (organization_id, lower(name))
                     WHERE deleted_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('departments')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
