import { BaseSchema } from '@adonisjs/lucid/schema'
import { newId } from '#shared/utils/crypto'

/**
 * Global plan catalogue (docs/backend/02 §9). The reference rows of 03 §6 are
 * inserted here: every organization needs the `free` plan from its creation.
 */
const PLANS = [
  {
    code: 'free',
    name: 'Gratuit',
    price: 0,
    maxEmployees: 10,
    aiCredits: 20,
    modules: ['hr', 'timeclock', 'leaves', 'performance', 'settings'],
  },
  {
    code: 'starter',
    name: 'Starter',
    price: 490_000,
    maxEmployees: 50,
    aiCredits: 100,
    modules: ['hr', 'timeclock', 'leaves', 'performance', 'settings'],
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 1_490_000,
    maxEmployees: 250,
    aiCredits: 500,
    modules: [
      'hr',
      'timeclock',
      'leaves',
      'performance',
      'recruitment',
      'talents',
      'settings',
      'integrations',
    ],
  },
  {
    code: 'enterprise',
    name: 'Entreprise',
    price: 3_900_000,
    maxEmployees: 100_000,
    aiCredits: 5000,
    modules: [
      'hr',
      'timeclock',
      'leaves',
      'performance',
      'recruitment',
      'talents',
      'settings',
      'integrations',
      'api',
    ],
  },
]

export default class extends BaseSchema {
  protected tableName = 'plans'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.text('code').notNullable().unique()
      t.text('name').notNullable()
      t.decimal('price_gnf', 14, 2).notNullable()
      t.decimal('price_yearly_gnf', 14, 2).nullable()
      t.integer('max_employees').notNullable()
      t.integer('ai_credits_per_month').notNullable().defaultTo(0)
      t.jsonb('modules').notNullable().defaultTo('[]')
      t.jsonb('features').notNullable().defaultTo('[]')
      t.integer('sort_order').notNullable().defaultTo(0)
      t.boolean('is_public').notNullable().defaultTo(true)
      t.timestamp('deleted_at', { useTz: true }).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(`CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON plans
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)

    this.defer(async (db) => {
      await db.table(this.tableName).multiInsert(
        PLANS.map((plan, index) => ({
          id: newId(),
          code: plan.code,
          name: plan.name,
          price_gnf: plan.price,
          max_employees: plan.maxEmployees,
          ai_credits_per_month: plan.aiCredits,
          modules: JSON.stringify(plan.modules),
          sort_order: index,
        }))
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
