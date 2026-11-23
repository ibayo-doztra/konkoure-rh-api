import { beforeCreate } from '@adonisjs/lucid/orm'
import { PerformanceReviewSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type ReviewStatus = PerformanceReviewSchema['status']

/** Evaluation (docs/backend/02 §8, 07 §5.7). Never serialized directly. */
export default class PerformanceReview extends PerformanceReviewSchema {
  static table = 'performance_reviews'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: PerformanceReview) {
    row.id ??= newId()
  }
}
