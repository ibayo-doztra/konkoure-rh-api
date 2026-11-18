import { beforeCreate } from '@adonisjs/lucid/orm'
import { PlanSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Global plan catalogue, outside any tenant (docs/backend/02 §9). */
export default class Plan extends PlanSchema {
  static table = 'plans'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(plan: Plan) {
    plan.id ??= newId()
  }
}
