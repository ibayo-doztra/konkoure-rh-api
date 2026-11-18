import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import limiter from '@adonisjs/limiter/services/main'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import { randomToken, sha256 } from '#shared/utils/crypto'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import users from '#modules/users/repositories/user_repository'
import resets from '#modules/auth/repositories/password_reset_repository'
import refreshTokens from '#modules/auth/repositories/refresh_token_repository'
import { ResetPasswordMail } from '#modules/auth/mails/localized_mail'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import { assertStrongPassword } from '#modules/auth/services/password_policy'
import { authSettings } from '#modules/auth/auth_settings'

/** Forgotten, reset and changed passwords (docs/backend/04 §2–3). */
export class PasswordService {
  /**
   * Always succeeds silently, known e-mail or not. 3 requests / hour / e-mail
   * (docs/backend/05 §8): the limit is keyed by the submitted address, so it
   * reveals nothing about the account.
   */
  async forgot(email: string) {
    await limiter.use({ requests: 3, duration: '1 hour' }).consume(`forgot:${email}`)
    const user = await users.findByEmail(email)
    if (!user || !user.isActive) return
    await this.sendResetLink(user)
  }

  /** Creates a single-use link (TTL 1 h) and e-mails it after commit. */
  async sendResetLink(user: User) {
    const token = randomToken(32)
    await db.transaction(async (trx) => {
      await resets.invalidatePending(user.id, trx)
      await resets.create(
        {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: DateTime.now().plus({ milliseconds: authSettings.passwordResetTtlMs }),
        },
        trx
      )
    })
    const url = `${authSettings.webAppUrl}/reset-password?token=${encodeURIComponent(token)}`
    await dispatchMail(new ResetPasswordMail(user, url))
  }

  /** Applies a new password from a reset link and revokes every session. */
  async reset(token: string, password: string, audit: AuditContext) {
    const invalid = () => AppException.validation('token', 'invalid', 'validation.token.invalid')

    await db.transaction(async (trx) => {
      const row = await resets.findByHashForUpdate(sha256(token), trx)
      if (!row || row.usedAt || row.expiresAt <= DateTime.now()) throw invalid()

      const user = await users.findByIdForUpdate(row.userId, trx)
      if (!user || !user.isActive) throw invalid()

      assertStrongPassword(password, user)
      user.passwordHash = await hash.make(password)
      user.mustResetPassword = false
      user.failedLoginAttempts = 0
      user.lockedUntil = null
      await users.save(user, trx)
      await resets.markUsed(row, trx)
      await refreshTokens.revokeAll(user.id, trx)
      await auditService.record(
        trx,
        { ...audit, actorUserId: user.id, actorEmail: user.email },
        { action: 'auth.password_reset', targetType: 'user', targetId: user.id }
      )
    })
  }

  /**
   * Change from the account: requires the current password and revokes every
   * other session (docs/backend/04 §2).
   */
  async change(
    user: User,
    currentPassword: string,
    password: string,
    currentFamilyId: string | null,
    audit: AuditContext
  ) {
    const valid = user.passwordHash ? await hash.verify(user.passwordHash, currentPassword) : false
    if (!valid) {
      throw AppException.validation(
        'currentPassword',
        'invalid',
        'validation.password.currentInvalid'
      )
    }
    assertStrongPassword(password, user)

    await db.transaction(async (trx) => {
      const locked = await users.findByIdForUpdate(user.id, trx)
      if (!locked) throw new AppException('E_UNAUTHORIZED')
      locked.passwordHash = await hash.make(password)
      await users.save(locked, trx)
      await refreshTokens.revokeAll(user.id, trx, currentFamilyId)
      await auditService.record(
        trx,
        { ...audit, actorUserId: user.id, actorEmail: user.email },
        { action: 'auth.password_changed', targetType: 'user', targetId: user.id }
      )
    })
  }
}

export default new PasswordService()
