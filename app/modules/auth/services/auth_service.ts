import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import users from '#modules/users/repositories/user_repository'
import refreshTokens from '#modules/auth/repositories/refresh_token_repository'
import tokenService, {
  type ClientInfo,
  type IssuedTokens,
} from '#modules/auth/services/token_service'
import emailVerification from '#modules/auth/services/email_verification_service'
import passwordService from '#modules/auth/services/password_service'
import loginThrottle from '#modules/auth/services/login_throttle'
import { assertStrongPassword } from '#modules/auth/services/password_policy'
import { authSettings } from '#modules/auth/auth_settings'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  preferredLanguage?: 'fr' | 'en'
}

/** Hash verified when the account is unknown, so timing does not reveal it. */
let dummyHash: Promise<string> | null = null
const dummy = () => (dummyHash ??= hash.make('konkoure-dummy-password-for-timing'))

/** Account creation, login and logout (docs/backend/04 §2–3, 06 §1). */
export class AuthService {
  async register(
    input: RegisterInput,
    client: ClientInfo
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    assertStrongPassword(input.password, input)
    if (await users.emailExists(input.email)) throw new AppException('E_CONFLICT')

    const passwordHash = await hash.make(input.password)
    const user = await db.transaction((trx) =>
      users.create(
        {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          preferredLanguage: input.preferredLanguage ?? 'fr',
        },
        trx
      )
    )

    await user.refresh()
    await emailVerification.send(user)
    const tokens = await tokenService.issue(user, client)
    return { user, tokens }
  }

  async login(
    email: string,
    password: string,
    client: ClientInfo,
    audit: AuditContext
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const ip = client.ip ?? 'unknown'
    await loginThrottle.assertAllowed(ip, email)

    const user = await users.findByEmail(email)

    if (!user || !user.isActive) {
      await hash.verify(await dummy(), password)
      await this.recordFailure(null, email, audit)
      await loginThrottle.recordFailure(ip, email)
      throw new AppException('E_UNAUTHORIZED')
    }

    if (user.lockedUntil && user.lockedUntil > DateTime.now()) {
      await hash.verify(await dummy(), password)
      await loginThrottle.recordFailure(ip, email)
      throw new AppException('E_ACCOUNT_LOCKED')
    }

    // Imported legacy account without a usable hash (docs/backend/04 §7).
    if (user.mustResetPassword || !user.passwordHash) {
      await hash.verify(await dummy(), password)
      await passwordService.sendResetLink(user)
      throw new AppException('E_PASSWORD_RESET_REQUIRED')
    }

    if (!(await hash.verify(user.passwordHash, password))) {
      const locked = await this.recordFailure(user, email, audit)
      await loginThrottle.recordFailure(ip, email)
      throw new AppException(locked ? 'E_ACCOUNT_LOCKED' : 'E_UNAUTHORIZED')
    }

    await db.transaction(async (trx) => {
      const fresh = await users.findByIdForUpdate(user.id, trx)
      if (!fresh) throw new AppException('E_UNAUTHORIZED')
      fresh.failedLoginAttempts = 0
      fresh.lockedUntil = null
      fresh.lastLoginAt = DateTime.now()
      await users.save(fresh, trx)
      await auditService.record(
        trx,
        { ...audit, actorUserId: user.id, actorEmail: user.email },
        { action: 'auth.login', targetType: 'user', targetId: user.id }
      )
    })
    await loginThrottle.recordSuccess(email)

    const tokens = await tokenService.issue(user, client)
    return { user, tokens }
  }

  /** Revokes the current session (access token + its refresh family). */
  async logout(user: User, familyId: string | null, audit: AuditContext) {
    await db.transaction(async (trx) => {
      if (familyId) {
        await refreshTokens.revokeFamily(user.id, familyId, trx)
      } else if (user.currentAccessToken) {
        await trx
          .from('auth_access_tokens')
          .where('id', String(user.currentAccessToken.identifier))
          .delete()
      }
      await auditService.record(
        trx,
        { ...audit, actorUserId: user.id, actorEmail: user.email },
        { action: 'auth.logout', targetType: 'session', targetId: familyId }
      )
    })
  }

  /** Revokes every session of the user. */
  async logoutAll(user: User, audit: AuditContext) {
    await db.transaction(async (trx) => {
      await refreshTokens.revokeAll(user.id, trx)
      await auditService.record(
        trx,
        { ...audit, actorUserId: user.id, actorEmail: user.email },
        { action: 'auth.logout', targetType: 'user', targetId: user.id, after: { scope: 'all' } }
      )
    })
  }

  /**
   * Counts a failed attempt; locks the account for 15 min at the 5th failure.
   * Returns true when this failure locked the account.
   */
  private async recordFailure(user: User | null, email: string, audit: AuditContext) {
    return db.transaction(async (trx) => {
      let locked = false
      if (user) {
        const fresh = await users.findByIdForUpdate(user.id, trx)
        if (fresh) {
          fresh.failedLoginAttempts += 1
          if (fresh.failedLoginAttempts >= authSettings.maxLoginAttempts) {
            fresh.failedLoginAttempts = 0
            fresh.lockedUntil = DateTime.now().plus({ milliseconds: authSettings.lockoutMs })
            locked = true
          }
          await users.save(fresh, trx)
        }
      }
      const context = { ...audit, actorUserId: user?.id ?? null, actorEmail: email }
      await auditService.record(trx, context, {
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: user?.id ?? null,
      })
      if (locked) {
        await auditService.record(trx, context, {
          action: 'auth.account_locked',
          targetType: 'user',
          targetId: user?.id ?? null,
        })
      }
      return locked
    })
  }
}

export default new AuthService()
