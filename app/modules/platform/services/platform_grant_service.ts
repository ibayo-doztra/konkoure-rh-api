import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PlatformAdmin from '#models/platform_admin'
import User from '#models/user'
import auditService from '#shared/audit/audit_service'

type Level = 'root' | 'support'
const LEVELS: readonly string[] = ['root', 'support']

export interface GrantOptions {
  /** Defaults to `app.inProduction`; overridden by the tests. */
  production?: boolean
}

/**
 * `node ace platform:grant` (decisions of 2026-11-25 and 2026-11-27): creates,
 * changes or revokes a platform admin outside the back office.
 *
 * - Outside production: any level, revocation allowed (end-to-end tests,
 *   local support); the last-root rule of `/platform/admins` does not apply.
 * - In production: only the bootstrap of the FIRST root (no active root yet),
 *   for an active account whose e-mail is verified. Every later admin goes
 *   through `/platform/admins`. There is no `ROOT_ADMIN_EMAIL` seeder: a
 *   standing variable would re-grant a revoked admin and hand root to whoever
 *   registers that address first (docs/backend/04 §4).
 */
export class PlatformGrantService {
  async grant(email: string, level: string, options: GrantOptions = {}) {
    const production = options.production ?? app.inProduction
    if (!LEVELS.includes(level)) throw new Error(`Unknown level "${level}": support or root`)
    if (production && level !== 'root') {
      throw new Error('In production, platform:grant only creates the first root admin')
    }
    return db.transaction(async (trx) => {
      const user = await this.userOf(email, trx)
      if (production) await this.assertBootstrap(user, trx)
      const admin = await PlatformAdmin.query({ client: trx })
        .where('user_id', user.id)
        .forUpdate()
        .first()
      const before = admin?.isActive ? { level: admin.level } : null
      const saved = admin
        ? await admin
            .merge({ level: level as Level, isActive: true })
            .useTransaction(trx)
            .save()
        : await PlatformAdmin.create(
            { userId: user.id, level: level as Level, isActive: true },
            { client: trx }
          )
      await auditService.record(
        trx,
        { actorRole: 'system' },
        {
          action: 'platform_admin.granted',
          targetType: 'user',
          targetId: user.id,
          before,
          after: production ? { level, bootstrap: true } : { level },
        }
      )
      return saved
    })
  }

  /** Deactivates the admin record; `false` when the account was not an active admin. */
  async revoke(email: string, options: GrantOptions = {}) {
    if (options.production ?? app.inProduction) {
      throw new Error('platform:grant --revoke is disabled in production: use /platform/admins')
    }
    return db.transaction(async (trx) => {
      const user = await this.userOf(email, trx)
      const admin = await PlatformAdmin.query({ client: trx })
        .where('user_id', user.id)
        .where('is_active', true)
        .forUpdate()
        .first()
      if (!admin) return false
      admin.isActive = false
      await admin.useTransaction(trx).save()
      await auditService.record(
        trx,
        { actorRole: 'system' },
        {
          action: 'platform_admin.revoked',
          targetType: 'user',
          targetId: user.id,
          before: { level: admin.level },
        }
      )
      return true
    })
  }

  /**
   * Production bootstrap guard. The advisory lock serializes two concurrent
   * runs, which could otherwise both see "no root" and create two.
   */
  private async assertBootstrap(user: User, trx: TransactionClientContract) {
    await trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
      'platform_admins:bootstrap',
    ])
    const root = await PlatformAdmin.query({ client: trx })
      .where('level', 'root')
      .where('is_active', true)
      .first()
    if (root) {
      throw new Error('A root admin already exists: add admins through /platform/admins')
    }
    if (!user.isActive) throw new Error(`The account "${user.email}" is inactive`)
    if (!user.emailVerifiedAt) {
      throw new Error(`The e-mail "${user.email}" is not verified: verify it first`)
    }
  }

  private async userOf(email: string, trx: TransactionClientContract) {
    const user = await User.query({ client: trx })
      .whereRaw('lower(email::text) = lower(?)', [email.trim()])
      .whereNull('deleted_at')
      .first()
    if (!user) throw new Error(`No account with the e-mail "${email}"`)
    return user
  }
}

export default new PlatformGrantService()
