import { beforeCreate } from '@adonisjs/lucid/orm'
import { PasswordResetTokenSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Single-use password reset token, hash only (docs/backend/04 §3). */
export default class PasswordResetToken extends PasswordResetTokenSchema {
  static table = 'password_reset_tokens'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(token: PasswordResetToken) {
    token.id ??= newId()
  }
}
