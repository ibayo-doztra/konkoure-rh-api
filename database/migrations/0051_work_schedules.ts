import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Work schedules (docs/backend/02 §6, decision of 2026-11-26): weekly ranges
 * per day, `{ mon: [{ start: '08:00', end: '12:00' }, …], … }`, a range whose
 * end is not after its start running into the next day (night shift).
 * `employee_id` null = organization template; at most one default per
 * organization and one own schedule per employee. Used by the attendance
 * aggregates (day boundaries, lateness).
 */
export default class extends BaseSchema {
  protected tableName = 'work_schedules'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.boolean('is_default').notNullable().defaultTo(false)
      t.jsonb('weekly_pattern').notNullable()
      t.uuid('employee_id').nullable().references('id').inTable('employees').onDelete('CASCADE')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(`ALTER TABLE work_schedules ADD CONSTRAINT work_schedules_default_template
                     CHECK (NOT is_default OR employee_id IS NULL)`)
    this.schema.raw(`CREATE UNIQUE INDEX work_schedules_one_default
                     ON work_schedules (organization_id) WHERE is_default`)
    this.schema.raw(`CREATE UNIQUE INDEX work_schedules_one_per_employee
                     ON work_schedules (organization_id, employee_id) WHERE employee_id IS NOT NULL`)
    this.schema.raw(`CREATE TRIGGER trg_work_schedules_updated
                     BEFORE UPDATE ON work_schedules
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('work_schedules')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
