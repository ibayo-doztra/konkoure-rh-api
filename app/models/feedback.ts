import { beforeCreate } from '@adonisjs/lucid/orm'
import { FeedbackSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type FeedbackKind = FeedbackSchema['kind']

/** Continuous feedback (docs/backend/02 §8, 07 §5.9). Never serialized directly. */
export default class Feedback extends FeedbackSchema {
  static table = 'feedbacks'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: Feedback) {
    row.id ??= newId()
  }
}
