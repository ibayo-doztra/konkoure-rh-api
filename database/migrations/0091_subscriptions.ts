import { BaseSchema } from '@adonisjs/lucid/schema'

/** Organization subscriptions (docs/backend/02 §9, 07 §6). */
export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('plan_id').notNullable().references('id').inTable('plans').onDelete('RESTRICT')
      t.specificType('status', 'subscription_status').notNullable().defaultTo('trialing')
      t.specificType('cycle', 'billing_cycle').notNullable().defaultTo('monthly')
      t.timestamp('trial_ends_at', { useTz: true }).nullable()
      t.timestamp('current_period_start', { useTz: true }).notNullable()
      t.timestamp('current_period_end', { useTz: true }).notNullable()
      t.timestamp('canceled_at', { useTz: true }).nullable()
      t.boolean('cancel_at_period_end').notNullable().defaultTo(false)
      t.integer('max_employees_override').nullable()
      t.jsonb('modules_override').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'created_at'])
    })

    this.schema.raw(`CREATE UNIQUE INDEX subscriptions_one_current_per_org
                     ON subscriptions (organization_id) WHERE status <> 'expired'`)
    this.schema.raw(`CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('subscriptions')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
