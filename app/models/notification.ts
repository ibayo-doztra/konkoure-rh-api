import { beforeCreate } from '@adonisjs/lucid/orm'
import { NotificationSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** In-app notification (02 §10, 07 §8). Never serialized directly. */
export default class Notification extends NotificationSchema {
  static table = 'notifications'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: Notification) {
    row.id ??= newId()
  }
}
