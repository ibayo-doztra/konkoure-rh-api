import { beforeCreate } from '@adonisjs/lucid/orm'
import { SuccessionPlanSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export const SUCCESSION_READINESS = ['ready_now', '1_2_years', '3_plus_years'] as const
export type SuccessionReadiness = (typeof SUCCESSION_READINESS)[number]

/** Succession plan of a key position (docs/backend/02 §8). Never serialized directly. */
export default class SuccessionPlan extends SuccessionPlanSchema {
  static table = 'succession_plans'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: SuccessionPlan) {
    row.id ??= newId()
  }
}
