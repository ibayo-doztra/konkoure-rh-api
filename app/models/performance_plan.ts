import { beforeCreate } from '@adonisjs/lucid/orm'
import { PerformancePlanSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type PlanStatus = PerformancePlanSchema['status']

/** Goal plan (docs/backend/02 §8). Never serialized directly. */
export default class PerformancePlan extends PerformancePlanSchema {
  static table = 'performance_plans'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(plan: PerformancePlan) {
    plan.id ??= newId()
  }
}
