import { column } from '@adonisjs/lucid/orm'
import { PlatformSettingSchema } from '#database/schema'

/** Platform setting (docs/backend/02 §10), keyed by `key`. Never serialized directly. */
export default class PlatformSetting extends PlatformSettingSchema {
  static table = 'platform_settings'
  static selfAssignPrimaryKey = true

  /** jsonb: booleans, numbers and objects are stored as JSON. */
  @column({ isPrimary: true })
  declare key: string

  @column({ prepare: (value: unknown) => JSON.stringify(value) })
  declare value: unknown
}
