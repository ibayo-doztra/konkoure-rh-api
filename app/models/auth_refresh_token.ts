import { beforeCreate } from '@adonisjs/lucid/orm'
import { AuthRefreshTokenSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Rotating refresh token; only its SHA-256 hash is stored (docs/backend/04 §1). */
export default class AuthRefreshToken extends AuthRefreshTokenSchema {
  static table = 'auth_refresh_tokens'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(token: AuthRefreshToken) {
    token.id ??= newId()
  }
}
