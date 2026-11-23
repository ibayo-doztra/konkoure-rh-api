import { beforeCreate } from '@adonisjs/lucid/orm'
import { CandidateNoteSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Note of the recruitment staff on a candidate (02 §7). Never serialized directly. */
export default class CandidateNote extends CandidateNoteSchema {
  static table = 'candidate_notes'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: CandidateNote) {
    row.id ??= newId()
  }
}
