import { beforeCreate } from '@adonisjs/lucid/orm'
import { NfcBadgeEventSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Badge journal entry (02 §5), insert only. */
export default class NfcBadgeEvent extends NfcBadgeEventSchema {
  static table = 'nfc_badge_events'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: NfcBadgeEvent) {
    row.id ??= newId()
  }
}
