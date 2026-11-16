import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import encryption from '@adonisjs/core/services/encryption'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import users from '#modules/users/repositories/user_repository'
import { VerifyEmailMail } from '#modules/auth/mails/localized_mail'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import { authSettings } from '#modules/auth/auth_settings'

const PURPOSE = 'email-verification'

interface VerificationPayload {
  userId: string
  email: string
}

/**
 * E-mail verification with a signed, expiring token (TTL 24 h, docs/backend/04 §3).
 * The token embeds the address: changing the e-mail invalidates older links.
 */
export class EmailVerificationService {
  async send(user: User) {
    const token = encryption.encrypt(
      { userId: user.id, email: user.email } satisfies VerificationPayload,
      authSettings.emailVerificationTtl,
      PURPOSE
    )
    const url = `${authSettings.webAppUrl}/verify-email?token=${encodeURIComponent(token)}`
    await dispatchMail(new VerifyEmailMail(user, url))
  }

  async verify(token: string) {
    const payload = encryption.decrypt<VerificationPayload>(token, PURPOSE)
    const invalid = () => AppException.validation('token', 'invalid', 'validation.token.invalid')
    if (!payload?.userId) throw invalid()

    await db.transaction(async (trx) => {
      const user = await users.findByIdForUpdate(payload.userId, trx)
      if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) throw invalid()
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = DateTime.now()
        await users.save(user, trx)
      }
    })
  }

  /** At most 3 e-mails per 24 h (06-api-reference §1). */
  async resend(user: User) {
    if (user.emailVerifiedAt) return
    await limiter.use({ requests: 3, duration: '24 hours' }).consume(`verify-email:${user.id}`)
    await this.send(user)
  }
}

export default new EmailVerificationService()
