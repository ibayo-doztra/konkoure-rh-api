import { BaseSchema } from '@adonisjs/lucid/schema'

/** Competencies held by employees, level 1 to 5 (docs/backend/02 §4). */
export default class extends BaseSchema {
  protected tableName = 'employee_skills'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.uuid('skill_id').notNullable().references('id').inTable('skills').onDelete('CASCADE')
      t.smallint('level').notNullable()
      t.date('assessed_at').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['employee_id', 'skill_id'])
      t.index(['organization_id', 'employee_id'])
      t.index(['organization_id', 'skill_id'])
    })

    this.schema.raw(`ALTER TABLE employee_skills ADD CONSTRAINT employee_skills_level_check
                     CHECK (level BETWEEN 1 AND 5)`)
    this.schema.raw(`CREATE TRIGGER trg_employee_skills_updated BEFORE UPDATE ON employee_skills
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('employee_skills')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
