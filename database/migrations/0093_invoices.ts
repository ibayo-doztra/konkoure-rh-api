import { BaseSchema } from '@adonisjs/lucid/schema'

/** Invoices of paid periods (docs/backend/02 §9, 07 §7.5), numbered `KNK-AAAA-NNNNNN`. */
export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.raw('CREATE SEQUENCE invoice_number_seq')
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('subscription_id')
        .notNullable()
        .references('id')
        .inTable('subscriptions')
        .onDelete('RESTRICT')
      t.uuid('payment_id').nullable().references('id').inTable('payments').onDelete('SET NULL')
      t.text('number').notNullable().unique()
      t.decimal('amount', 14, 2).notNullable()
      t.specificType('currency', 'char(3)').notNullable().defaultTo('GNF')
      t.timestamp('issued_at', { useTz: true }).notNullable()
      t.timestamp('period_start', { useTz: true }).notNullable()
      t.timestamp('period_end', { useTz: true }).notNullable()
      t.text('pdf_path').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'issued_at'])
      t.unique(['payment_id'])
    })

    this.schema.raw(`CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('invoices')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP SEQUENCE IF EXISTS invoice_number_seq')
  }
}
