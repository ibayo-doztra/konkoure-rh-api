import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuthRefreshToken from '#models/auth_refresh_token'

/** Head of a token family = an open session (one device / browser). */
export interface SessionRow {
  familyId: string
  deviceLabel: string | null
  ip: string | null
  userAgent: string | null
  startedAt: DateTime
  lastActivityAt: DateTime
  expiresAt: DateTime
}

/**
 * Refresh tokens and the access tokens bound to them. Access tokens store their
 * family id in `auth_access_tokens.name`, so revoking a session drops both.
 */
export class RefreshTokenRepository {
  create(
    data: Pick<
      AuthRefreshToken,
      | 'userId'
      | 'tokenHash'
      | 'familyId'
      | 'parentId'
      | 'deviceLabel'
      | 'ip'
      | 'userAgent'
      | 'expiresAt'
    >,
    trx: TransactionClientContract
  ) {
    return AuthRefreshToken.create(data, { client: trx })
  }

  /** User id owning a token, whatever its state (used for per-user throttling). */
  async ownerOf(tokenHash: string): Promise<string | null> {
    const row = await AuthRefreshToken.query()
      .where('token_hash', tokenHash)
      .select('user_id')
      .first()
    return row?.userId ?? null
  }

  findByHashForUpdate(tokenHash: string, trx: TransactionClientContract) {
    return AuthRefreshToken.query({ client: trx })
      .where('token_hash', tokenHash)
      .forUpdate()
      .first()
  }

  markReplaced(token: AuthRefreshToken, trx: TransactionClientContract) {
    token.useTransaction(trx)
    token.replacedAt = DateTime.now()
    return token.save()
  }

  /** Revokes a whole family and deletes its access tokens. */
  async revokeFamily(userId: string, familyId: string, trx: TransactionClientContract) {
    const revoked = await AuthRefreshToken.query({ client: trx })
      .where('user_id', userId)
      .where('family_id', familyId)
      .whereNull('revoked_at')
      .update({ revoked_at: DateTime.now().toSQL() })
    await trx
      .from('auth_access_tokens')
      .where('tokenable_id', userId)
      .where('name', familyId)
      .delete()
    return Number(Array.isArray(revoked) ? revoked[0] : revoked)
  }

  /** Revokes every session of a user, optionally keeping one family. */
  async revokeAll(userId: string, trx: TransactionClientContract, exceptFamilyId?: string | null) {
    await AuthRefreshToken.query({ client: trx })
      .where('user_id', userId)
      .whereNull('revoked_at')
      .if(exceptFamilyId, (q) => q.whereNot('family_id', exceptFamilyId!))
      .update({ revoked_at: DateTime.now().toSQL() })
    await trx
      .from('auth_access_tokens')
      .where('tokenable_id', userId)
      .if(exceptFamilyId, (q) =>
        q.where((w) => w.whereNull('name').orWhereNot('name', exceptFamilyId!))
      )
      .delete()
  }

  async familyBelongsTo(userId: string, familyId: string) {
    const row = await AuthRefreshToken.query()
      .where('user_id', userId)
      .where('family_id', familyId)
      .whereNull('revoked_at')
      .first()
    return row !== null
  }

  /** Open sessions: non revoked, non replaced, non expired heads of families. */
  async listSessions(userId: string): Promise<SessionRow[]> {
    const rows = await db
      .from('auth_refresh_tokens as head')
      .where('head.user_id', userId)
      .whereNull('head.revoked_at')
      .whereNull('head.replaced_at')
      .where('head.expires_at', '>', DateTime.now().toSQL())
      .select(
        'head.family_id',
        'head.device_label',
        'head.ip',
        'head.user_agent',
        'head.created_at as last_activity_at',
        'head.expires_at',
        db.raw(
          '(SELECT min(f.created_at) FROM auth_refresh_tokens f WHERE f.family_id = head.family_id) as started_at'
        )
      )
      .orderBy('head.created_at', 'desc')

    return rows.map((row) => ({
      familyId: row.family_id,
      deviceLabel: row.device_label,
      ip: row.ip,
      userAgent: row.user_agent,
      startedAt: DateTime.fromJSDate(row.started_at),
      lastActivityAt: DateTime.fromJSDate(row.last_activity_at),
      expiresAt: DateTime.fromJSDate(row.expires_at),
    }))
  }
}

export default new RefreshTokenRepository()
