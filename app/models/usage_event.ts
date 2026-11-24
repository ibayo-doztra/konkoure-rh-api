import { beforeCreate } from '@adonisjs/lucid/orm'
import { UsageEventSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Usage journal entry (docs/backend/02 §7), insert only. Never serialized directly. */
export default class UsageEvent extends UsageEventSchema {
  static table = 'usage_events'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: UsageEvent) {
    row.id ??= newId()
  }
}
