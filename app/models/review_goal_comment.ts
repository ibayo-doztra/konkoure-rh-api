import { beforeCreate } from '@adonisjs/lucid/orm'
import { ReviewGoalCommentSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Self and manager comment on a goal of an evaluation (02 §8). Never serialized directly. */
export default class ReviewGoalComment extends ReviewGoalCommentSchema {
  static table = 'review_goal_comments'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: ReviewGoalComment) {
    row.id ??= newId()
  }
}
