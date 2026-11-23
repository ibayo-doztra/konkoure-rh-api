import { beforeCreate } from '@adonisjs/lucid/orm'
import { GoalSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type GoalCategory = GoalSchema['category']
export type GoalStatus = GoalSchema['status']

/** Goal (docs/backend/02 §8, 07 §5.2). Never serialized directly. */
export default class Goal extends GoalSchema {
  static table = 'goals'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(goal: Goal) {
    goal.id ??= newId()
  }
}
