import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { PlanSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Global plan catalogue, outside any tenant (docs/backend/02 §9). */
export default class Plan extends PlanSchema {
  static table = 'plans'
  static selfAssignPrimaryKey = true

  /** The pg driver would write a JS array as a PostgreSQL array, not as jsonb. */
  @column({ prepare: (value: string[]) => JSON.stringify(value) })
  declare modules: string[]

  @column({ prepare: (value: string[]) => JSON.stringify(value) })
  declare features: string[]

  @beforeCreate()
  static assignId(plan: Plan) {
    plan.id ??= newId()
  }
}
