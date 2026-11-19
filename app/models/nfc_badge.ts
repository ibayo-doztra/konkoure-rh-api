import { beforeCreate } from '@adonisjs/lucid/orm'
import { NfcBadgeSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** NFC badge (02 §5): only the UID hash and its masked form are stored (05 §6). */
export default class NfcBadge extends NfcBadgeSchema {
  static table = 'nfc_badges'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: NfcBadge) {
    row.id ??= newId()
  }
}
