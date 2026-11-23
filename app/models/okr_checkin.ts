import { beforeCreate } from '@adonisjs/lucid/orm'
import { OkrCheckinSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Progress point of an OKR (07 §5.5). Never serialized directly. */
export default class OkrCheckin extends OkrCheckinSchema {
  static table = 'okr_checkins'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: OkrCheckin) {
    row.id ??= newId()
  }
}
