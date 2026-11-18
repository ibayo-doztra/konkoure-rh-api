import env from '#start/env'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { UserSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/**
 * Global account (docs/backend/02 §3). Never serialized directly: responses go
 * through the users module transformers, so `passwordHash` cannot leak.
 */
export default class User extends UserSchema {
  static table = 'users'
  static selfAssignPrimaryKey = true

  /** Opaque access tokens `oat_…`, 15 minutes (docs/backend/04 §1). */
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    table: 'auth_access_tokens',
    type: 'auth_token',
    prefix: 'oat_',
    expiresIn: env.get('ACCESS_TOKEN_TTL', '15m'),
  })

  declare currentAccessToken?: AccessToken

  @beforeCreate()
  static assignId(user: User) {
    user.id ??= newId()
  }

  /** Account usable for authentication right now. */
  get canAuthenticate(): boolean {
    return this.isActive && this.deletedAt === null
  }
}
