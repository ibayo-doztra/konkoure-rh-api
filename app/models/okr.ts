import { beforeCreate } from '@adonisjs/lucid/orm'
import { OkrSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type OkrStatus = OkrSchema['status']
export type OkrReviewStatus = OkrSchema['reviewStatus']

/** OKR objective (docs/backend/02 §8, 07 §5.3). Never serialized directly. */
export default class Okr extends OkrSchema {
  static table = 'okrs'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: Okr) {
    row.id ??= newId()
  }
}
