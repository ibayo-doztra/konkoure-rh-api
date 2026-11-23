import { beforeCreate } from '@adonisjs/lucid/orm'
import { OkrKeyResultSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Key result of an OKR (docs/backend/02 §8). Never serialized directly. */
export default class OkrKeyResult extends OkrKeyResultSchema {
  static table = 'okr_key_results'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: OkrKeyResult) {
    row.id ??= newId()
  }
}
