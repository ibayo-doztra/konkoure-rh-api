import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { CandidateSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type CandidateStage = CandidateSchema['stage']
export type CandidateSource = NonNullable<CandidateSchema['source']>

/** The pg driver would write a JS array as a PostgreSQL array, not as jsonb. */
const jsonArray = { prepare: (value: string[]) => JSON.stringify(value) }

/**
 * Candidate (docs/backend/02 §7, 07 §4). Never serialized directly: document
 * paths stay private and are only reached through signed links.
 */
export default class Candidate extends CandidateSchema {
  static table = 'candidates'
  static selfAssignPrimaryKey = true

  @column(jsonArray)
  declare aiStrengths: string[]

  @column(jsonArray)
  declare aiWeaknesses: string[]

  @beforeCreate()
  static assignId(candidate: Candidate) {
    candidate.id ??= newId()
  }
}
