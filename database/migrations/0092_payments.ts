import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Djomy payments (docs/backend/02 §9, 07 §7). `organization_id` is null for a
 * payment made before sign-up (07 §7.7) until it is claimed.
 */
export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('subscription_id')
        .nullable()
        .references('id')
        .inTable('subscriptions')
        .onDelete('SET NULL')
      t.uuid('plan_id').notNullable().references('id').inTable('plans').onDelete('RESTRICT')
      t.specificType('cycle', 'billing_cycle').notNullable()
      t.uuid('merchant_reference').notNullable().unique()
      t.text('provider').notNullable().defaultTo('djomy')
      t.text('provider_transaction_id').nullable().unique()
      t.decimal('expected_amount', 14, 2).notNullable()
      t.decimal('paid_amount', 14, 2).nullable()
      t.specificType('currency', 'char(3)').notNullable().defaultTo('GNF')
      t.specificType('status', 'payment_status').notNullable().defaultTo('pending')
      t.specificType('method', 'payment_method').nullable()
      t.text('payer_phone').nullable()
      t.text('claim_token_hash').nullable().unique()
      t.specificType('claim_email', 'citext').nullable()
      t.timestamp('claim_expires_at', { useTz: true }).nullable()
      t.timestamp('claimed_at', { useTz: true }).nullable()
      t.text('failure_reason').nullable()
      t.jsonb('raw_event').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(
      'CREATE INDEX payments_org_created_idx ON payments (organization_id, created_at DESC)'
    )
    this.schema.raw('CREATE INDEX payments_status_created_idx ON payments (status, created_at)')
    this.schema.raw(`CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('payments')`)
    // Pre-signup payments live outside any tenant until they are claimed (07 §7.7).
    this.schema.raw(`
      CREATE POLICY presignup_payments ON payments TO konkoure_app
      USING (organization_id IS NULL AND current_org_id() IS NULL)
      WITH CHECK (organization_id IS NULL AND current_org_id() IS NULL)
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
