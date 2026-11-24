import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { SystemLogSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Technical journal entry (docs/backend/02 §10). Never serialized directly. */
export default class SystemLog extends SystemLogSchema {
  static table = 'system_logs'
  static selfAssignPrimaryKey = true

  /** The pg driver would not encode a plain object as jsonb reliably. */
  @column({ prepare: (value: Record<string, unknown>) => JSON.stringify(value) })
  declare context: Record<string, unknown>

  @beforeCreate()
  static assignId(row: SystemLog) {
    row.id ??= newId()
  }
}
