import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import { newId, randomToken, sha256 } from '#shared/utils/crypto'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import refreshTokens from '#modules/auth/repositories/refresh_token_repository'
import { SessionCompromisedMail } from '#modules/auth/mails/localized_mail'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import { authSettings } from '#modules/auth/auth_settings'

export interface ClientInfo {
  ip: string | null
  userAgent: string | null
  /** Set by the mobile app; selects the longer mobile refresh lifetime. */
  deviceLabel: string | null
}

export interface IssuedTokens {
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
}

/**
 * Access + refresh token pairs (docs/backend/04 §1). A session is a family of
 * refresh tokens: each refresh consumes the presented token and issues the next
 * one; presenting a consumed token again revokes the whole family.
 */
export class TokenService {
  /** Opens a new session for an authenticated user. */
  async issue(user: User, client: ClientInfo): Promise<IssuedTokens> {
    const familyId = newId()
    const refreshTtlMs = client.deviceLabel
      ? authSettings.refreshTokenTtlMobileMs
      : authSettings.refreshTokenTtlMs
    const refreshToken = randomToken(64, 'rt_')

    await db.transaction(async (trx) => {
      await refreshTokens.create(
        {
          userId: user.id,
          tokenHash: sha256(refreshToken),
          familyId,
          parentId: null,
          deviceLabel: client.deviceLabel,
          ip: client.ip,
          userAgent: client.userAgent,
          expiresAt: DateTime.now().plus({ milliseconds: refreshTtlMs }),
        },
        trx
      )
    })

    return this.pair(user, familyId, refreshToken, refreshTtlMs)
  }

  /** Rotates a refresh token. Throws 401 on any invalid, expired or replayed token. */
  async rotate(presented: string, client: ClientInfo, audit: AuditContext): Promise<IssuedTokens> {
    // 60 refreshes per hour and per user (docs/backend/05 §8), checked before
    // rotating so a throttled client keeps its still-valid refresh token.
    const owner = await refreshTokens.ownerOf(sha256(presented))
    if (owner) {
      await limiter.use({ requests: 60, duration: '1 hour' }).consume(`refresh:${owner}`)
    }

    const outcome = await db.transaction(async (trx) => {
      const current = await refreshTokens.findByHashForUpdate(sha256(presented), trx)
      if (!current) return { kind: 'invalid' as const }

      if (current.revokedAt || current.replacedAt) {
        await refreshTokens.revokeFamily(current.userId, current.familyId, trx)
        await auditService.record(
          trx,
          { ...audit, actorUserId: current.userId },
          {
            action: 'security.refresh_reuse_detected',
            targetType: 'session',
            targetId: current.familyId,
          }
        )
        return { kind: 'reused' as const, userId: current.userId }
      }

      if (current.expiresAt <= DateTime.now()) return { kind: 'invalid' as const }

      const user = await User.query({ client: trx })
        .where('id', current.userId)
        .whereNull('deleted_at')
        .first()
      if (!user || !user.canAuthenticate) {
        await refreshTokens.revokeFamily(current.userId, current.familyId, trx)
        return { kind: 'invalid' as const }
      }

      // Keep the lifetime chosen when the session was opened (web or mobile).
      const ttlMs = current.expiresAt.diff(current.createdAt).toMillis()
      const next = randomToken(64, 'rt_')
      await refreshTokens.markReplaced(current, trx)
      await refreshTokens.create(
        {
          userId: user.id,
          tokenHash: sha256(next),
          familyId: current.familyId,
          parentId: current.id,
          deviceLabel: current.deviceLabel,
          ip: client.ip,
          userAgent: client.userAgent,
          expiresAt: DateTime.now().plus({ milliseconds: ttlMs }),
        },
        trx
      )
      // The previous access token of this session stops working now.
      await trx
        .from('auth_access_tokens')
        .where('tokenable_id', user.id)
        .where('name', current.familyId)
        .delete()
      return { kind: 'rotated' as const, user, familyId: current.familyId, next, ttlMs }
    })

    if (outcome.kind === 'reused') {
      const user = await User.find(outcome.userId)
      if (user) {
        await dispatchMail(new SessionCompromisedMail(user))
      }
      throw new AppException('E_UNAUTHORIZED')
    }
    if (outcome.kind === 'invalid') throw new AppException('E_UNAUTHORIZED')

    return this.pair(outcome.user, outcome.familyId, outcome.next, outcome.ttlMs)
  }

  private async pair(
    user: User,
    familyId: string,
    refreshToken: string,
    refreshTtlMs: number
  ): Promise<IssuedTokens> {
    const access = await User.accessTokens.create(user, ['*'], { name: familyId })
    return {
      accessToken: access.value!.release(),
      expiresIn: Math.round(authSettings.accessTokenTtlMs / 1000),
      refreshToken,
      refreshExpiresIn: Math.round(refreshTtlMs / 1000),
    }
  }
}

export default new TokenService()
