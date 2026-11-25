import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PlatformAdmin from '#models/platform_admin'
import User from '#models/user'
import auditService from '#shared/audit/audit_service'

type Level = 'root' | 'support'
const LEVELS: readonly string[] = ['root', 'support']

/**
 * `node ace platform:grant` (decision of 2026-11-25): creates, changes or
 * revokes a platform admin outside the back office, for end-to-end tests and
 * local support (the first admin cannot be created through the API).
 * Refused in production; the last-root rule of `/platform/admins` does not
 * apply here.
 */
export class PlatformGrantService {
  async grant(email: string, level: string) {
    this.assertAllowed()
    if (!LEVELS.includes(level)) throw new Error(`Unknown level "${level}": support or root`)
    return db.transaction(async (trx) => {
      const user = await this.userOf(email, trx)
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
          after: { level },
        }
      )
      return saved
    })
  }

  /** Deactivates the admin record; `false` when the account was not an active admin. */
  async revoke(email: string) {
    this.assertAllowed()
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

  private assertAllowed() {
    if (app.inProduction) throw new Error('platform:grant is disabled in production')
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
