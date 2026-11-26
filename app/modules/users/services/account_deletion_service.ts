import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import PlatformAdmin from '#models/platform_admin'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import users from '#modules/users/repositories/user_repository'
import accounts from '#modules/users/repositories/account_deletion_repository'
import refreshTokens from '#modules/auth/repositories/refresh_token_repository'

/**
 * `DELETE /me` (docs/backend/04 §3, 05 §13, decision of 2026-11-26): the
 * account is anonymized at once (`deleted+<id>@invalid`, name and avatar
 * cleared, deactivated), every session ends, every role is removed, and the
 * employee records stay with their organizations, unlinked from the account.
 * Refused while the user is the only owner of an organization or the last
 * active root. Audit logs keep the technical id only.
 */
export class AccountDeletionService {
  async delete(user: User, password: string, audit: AuditContext) {
    const valid = user.passwordHash ? await hash.verify(user.passwordHash, password) : false
    if (!valid) {
      throw AppException.validation('password', 'invalid', 'validation.password.currentInvalid')
    }
    const organizationIds = await accounts.organizationsOf(user.id)

    await db.transaction(async (trx) => {
      const locked = await users.findByIdForUpdate(user.id, trx)
      if (!locked) throw new AppException('E_UNAUTHORIZED')

      const soleOwner = await accounts.soleOwnerships(user.id, trx)
      if (soleOwner.length > 0) {
        throw new AppException('E_CONFLICT', {
          details: soleOwner.map((id) => ({
            field: `organizations.${id}`,
            rule: 'lastOwner',
            message: 'validation.me.lastOwner',
          })),
        })
      }
      await this.leavePlatform(user.id, trx)

      for (const organizationId of organizationIds) {
        await accounts.detachFrom(organizationId, user.id, trx)
      }
      await accounts.removeRoles(user.id, trx)
      await accounts.removeResetTokens(user.id, trx)
      await refreshTokens.revokeAll(user.id, trx)

      locked.merge({
        email: `deleted+${user.id}@invalid`,
        fullName: null,
        avatarUrl: null,
        passwordHash: null,
        emailVerifiedAt: null,
        isActive: false,
        deletedAt: DateTime.now(),
      })
      await users.save(locked, trx)
      await auditService.record(
        trx,
        { ...audit, actorUserId: user.id, actorEmail: null, organizationId: null },
        {
          action: 'user.deleted',
          targetType: 'user',
          targetId: user.id,
          after: { organizations: organizationIds.length },
        }
      )
    })
  }

  /** An active admin record is closed; the last active root is kept (409). */
  private async leavePlatform(userId: string, trx: Parameters<typeof users.save>[1]) {
    const admin = await PlatformAdmin.query({ client: trx })
      .where('user_id', userId)
      .where('is_active', true)
      .forUpdate()
      .first()
    if (!admin) return
    if (admin.level === 'root') {
      const roots = await PlatformAdmin.query({ client: trx })
        .where('level', 'root')
        .where('is_active', true)
        .forUpdate()
      if (!roots.some((root) => root.userId !== userId)) {
        throw new AppException('E_CONFLICT', {
          details: [
            { field: 'platform', rule: 'lastRoot', message: 'validation.platform.lastRoot' },
          ],
        })
      }
    }
    admin.isActive = false
    await admin.useTransaction(trx).save()
  }
}

export default new AccountDeletionService()
