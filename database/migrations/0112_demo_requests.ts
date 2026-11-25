import { BaseSchema } from '@adonisjs/lucid/schema'

/** Demo requests from the public site (docs/backend/02 §10), outside any tenant. */
export default class extends BaseSchema {
  protected tableName = 'demo_requests'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.text('full_name').notNullable()
      t.specificType('email', 'citext').notNullable()
      t.text('phone').notNullable()
      t.text('company_name').notNullable()
      t.text('company_size').notNullable()
      t.text('message').nullable()
      t.specificType('status', 'demo_request_status').notNullable().defaultTo('new')
      t.specificType('email_status', 'email_delivery_status').notNullable().defaultTo('pending')
      t.timestamp('email_sent_at', { useTz: true }).nullable()
      t.text('email_error').nullable()
      t.specificType('source_ip', 'inet').nullable()
      t.uuid('assigned_to').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['status', 'created_at'])
    })
    this.schema.raw(`CREATE TRIGGER trg_demo_requests_updated BEFORE UPDATE ON demo_requests
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
