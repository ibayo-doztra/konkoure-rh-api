import { BaseSchema } from '@adonisjs/lucid/schema'

/** Leave requests (docs/backend/02 §6, 03 §4, 07 §3). */
export default class extends BaseSchema {
  protected tableName = 'leave_requests'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
      t.specificType('type', 'leave_type').notNullable()
      t.date('start_date').notNullable()
      t.date('end_date').notNullable()
      t.decimal('requested_days', 5, 2).notNullable()
      t.boolean('half_day_start').notNullable().defaultTo(false)
      t.boolean('half_day_end').notNullable().defaultTo(false)
      t.specificType('status', 'leave_status').notNullable().defaultTo('pending')
      t.text('reason').nullable()
      t.text('decision_comment').nullable()
      t.uuid('decided_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('decided_at', { useTz: true }).nullable()
      t.boolean('balance_applied').notNullable().defaultTo(false)
      t.text('attachment_path').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_dates_check
                     CHECK (end_date >= start_date)`)
    this.schema.raw(`ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_days_check
                     CHECK (requested_days > 0)`)
    this.schema.raw(`ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_no_overlap
                     EXCLUDE USING gist (
                       employee_id WITH =,
                       daterange(start_date, end_date, '[]') WITH &&
                     ) WHERE (status IN ('pending', 'approved'))`)
    this.schema.raw(`CREATE INDEX leave_requests_org_status_start_idx
                     ON leave_requests (organization_id, status, start_date DESC)`)
    this.schema.raw(`CREATE INDEX leave_requests_employee_start_idx
                     ON leave_requests (employee_id, start_date DESC)`)
    this.schema.raw(`CREATE TRIGGER trg_leave_requests_updated BEFORE UPDATE ON leave_requests
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('leave_requests')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
