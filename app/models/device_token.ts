import { beforeCreate } from '@adonisjs/lucid/orm'
import { DeviceTokenSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Kiosk device token (05 §6): only its SHA-256 is stored. */
export default class DeviceToken extends DeviceTokenSchema {
  static table = 'device_tokens'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: DeviceToken) {
    row.id ??= newId()
  }
}
