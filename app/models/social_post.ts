import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { SocialPostSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Publication of a job offer on a social account (02 §10, 08 §8). Never serialized directly. */
export default class SocialPost extends SocialPostSchema {
  static table = 'social_posts'
  static selfAssignPrimaryKey = true

  /** The pg driver would write a JS array as a PostgreSQL array, not as jsonb. */
  @column({ prepare: (value: string[]) => JSON.stringify(value) })
  declare mediaUrls: string[]

  @beforeCreate()
  static assignId(post: SocialPost) {
    post.id ??= newId()
  }
}
