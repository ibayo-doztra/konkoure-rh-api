import { beforeCreate } from '@adonisjs/lucid/orm'
import { UsageCounterSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Monthly usage counter (docs/backend/02 §9, 07 §6.8). Never serialized directly. */
export default class UsageCounter extends UsageCounterSchema {
  static table = 'usage_counters'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: UsageCounter) {
    row.id ??= newId()
  }
}
