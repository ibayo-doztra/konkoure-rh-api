import { beforeCreate } from '@adonisjs/lucid/orm'
import { GoalActivitySchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type GoalActivityStatus = GoalActivitySchema['status']

/** Activity planned to reach a goal (docs/backend/02 §8). Never serialized directly. */
export default class GoalActivity extends GoalActivitySchema {
  static table = 'goal_activities'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(activity: GoalActivity) {
    activity.id ??= newId()
  }
}
