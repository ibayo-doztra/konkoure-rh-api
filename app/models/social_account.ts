import { beforeCreate } from '@adonisjs/lucid/orm'
import { SocialAccountSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type SocialProvider = SocialAccountSchema['provider']

/**
 * Social account of an organization (docs/backend/02 §10): a LinkedIn company
 * page or a Facebook page. Tokens are stored encrypted only. Never serialized directly.
 */
export default class SocialAccount extends SocialAccountSchema {
  static table = 'social_accounts'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(account: SocialAccount) {
    account.id ??= newId()
  }
}
