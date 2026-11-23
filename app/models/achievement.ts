import { beforeCreate } from '@adonisjs/lucid/orm'
import { AchievementSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Achievement of an employee (docs/backend/02 §8). Never serialized directly. */
export default class Achievement extends AchievementSchema {
  static table = 'achievements'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: Achievement) {
    row.id ??= newId()
  }
}
