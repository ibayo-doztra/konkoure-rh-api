import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PlatformAdmin from '#models/platform_admin'
import User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'

type Level = 'root' | 'support'

const ROOT_ROLE = 'platform_root'

/**
 * `/platform/admins` (root, 06 §13). Platform roles live only in
 * `platform_admins` (04 §4); the last active root can never be removed or
 * downgraded (decision of 2026-11-24).
 */
export class PlatformAdminService {
  /** Active admins with their account. */
  async list() {
    const admins = await PlatformAdmin.query().where('is_active', true).orderBy('created_at', 'asc')
    const users = await User.query().whereIn(
      'id',
      admins.map((admin) => admin.userId)
    )
    const byId = new Map(users.map((user) => [user.id, user]))
    return admins.map((admin) => ({ admin, user: byId.get(admin.userId) ?? null }))
  }

  /** Grants (or changes) the level of an existing account, by e-mail. */
  async grant(actor: User, input: { email: string; level: Level }, audit: AuditContext) {
    return db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .whereRaw('lower(email::text) = lower(?)', [input.email])
        .whereNull('deleted_at')
        .first()
      if (!user) throw AppException.validation('email', 'exists', 'validation.platform.unknownUser')
      if (!user.canAuthenticate) {
        throw AppException.validation('email', 'active', 'validation.platform.banned')
      }
      const admin = await PlatformAdmin.query({ client: trx })
        .where('user_id', user.id)
        .forUpdate()
        .first()
      const before = admin?.isActive ? { level: admin.level } : null
      if (admin?.isActive && admin.level === 'root' && input.level !== 'root') {
        await this.assertAnotherRoot(trx, user.id)
      }
      const saved = admin
        ? await admin.merge({ level: input.level, isActive: true }).useTransaction(trx).save()
        : await PlatformAdmin.create(
            { userId: user.id, level: input.level, createdBy: actor.id },
            { client: trx }
          )
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: ROOT_ROLE },
        {
          action: 'platform_admin.granted',
          targetType: 'user',
          targetId: user.id,
          before,
          after: { level: input.level },
        }
      )
      return { admin: saved, user }
    })
  }

  /** Removes the platform access of an account (row deactivated). */
  async revoke(actor: User, userId: string, audit: AuditContext) {
    await db.transaction(async (trx) => {
      const admin = await PlatformAdmin.query({ client: trx })
        .where('user_id', userId)
        .where('is_active', true)
        .forUpdate()
        .first()
      if (!admin) throw new AppException('E_NOT_FOUND')
      if (admin.level === 'root') await this.assertAnotherRoot(trx, userId)
      admin.isActive = false
      await admin.useTransaction(trx).save()
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: ROOT_ROLE },
        {
          action: 'platform_admin.revoked',
          targetType: 'user',
          targetId: userId,
          before: { level: admin.level },
        }
      )
    })
  }

  /** Locks the active roots, so two removals cannot both pass (last root kept). */
  private async assertAnotherRoot(trx: TransactionClientContract, userId: string) {
    const roots = await PlatformAdmin.query({ client: trx })
      .where('level', 'root')
      .where('is_active', true)
      .forUpdate()
    if (!roots.some((root) => root.userId !== userId)) {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'userId', rule: 'lastRoot', message: 'validation.platform.lastRoot' }],
      })
    }
  }
}

export default new PlatformAdminService()
