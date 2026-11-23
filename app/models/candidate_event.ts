import { beforeCreate } from '@adonisjs/lucid/orm'
import { CandidateEventSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type CandidateEventType = CandidateEventSchema['type']

/** History entry of a candidate, insert-only (02 §7). Never serialized directly. */
export default class CandidateEvent extends CandidateEventSchema {
  static table = 'candidate_events'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: CandidateEvent) {
    row.id ??= newId()
  }
}
