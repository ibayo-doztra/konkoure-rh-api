import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import type { AppRole } from '#models/user_role'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import refreshTokens from '#modules/auth/repositories/refresh_token_repository'
import memberService from '#modules/organizations/services/member_service'
import platformAdmins from '#modules/users/repositories/platform_admin_repository'
import { IMPERSONATION_PREFIX } from '#modules/auth/impersonation'
import organizations from '#modules/platform/repositories/platform_organization_repository'
import platformUsers from '#modules/platform/repositories/platform_user_repository'

/** Impersonation lasts 30 minutes, without refresh (04 §5, decision of 2026-11-24). */
export const IMPERSONATION_MINUTES = 30

const ROOT_ROLE = 'platform_root'

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'id', rule, message }] })

/** Back-office accounts (docs/backend/06 §13, decisions of 2026-11-24). */
export class PlatformUserService {
  /** `GET /platform/users`: accounts with their organizations, roles and platform level. */
  async search(filters: { page: number; perPage: number; q?: string }) {
    const page = await platformUsers.search(filters)
    const ids = page.all().map((user) => user.id)
    const [memberships, levels] = await Promise.all([
      platformUsers.memberships(ids),
      platformUsers.adminLevels(ids),
    ])
    return { page, memberships, levels }
  }

  /**
   * `PATCH /platform/users/:id/roles` (root): replaces the account's roles in
   * one organization, with the protections of the members API (last owner).
   * An empty list removes the account from the organization.
   */
  async updateRoles(
    actor: User,
    userId: string,
    input: { organizationId: string; roles: AppRole[] },
    audit: AuditContext
  ) {
    const organization = await organizations.find(input.organizationId)
    if (!organization || organization.deletedAt) throw new AppException('E_NOT_FOUND')
    // Owner scope: the platform may hand out or take back every role.
    const tenant = new TenantContext(organization.id, ['owner'], null)
    const context = { ...audit, actorUserId: actor.id, actorRole: ROOT_ROLE }
    if (input.roles.length === 0) {
      await memberService.remove(tenant, userId, context)
      return []
    }
    const member = await memberService.updateRoles(tenant, actor, userId, input.roles, context)
    return member.roles
  }

  /** `POST /platform/users/:id/ban` (root): the account stops working at once. */
  async ban(actor: User, userId: string, reason: string, audit: AuditContext) {
    if (userId === actor.id) throw conflict('self', 'validation.platform.self')
    if (await platformAdmins.isActive(userId)) {
      throw conflict('platformAdmin', 'validation.platform.platformAdmin')
    }
    return this.setActive(actor, userId, false, reason, audit)
  }

  /** `POST /platform/users/:id/unban` (root). */
  unban(actor: User, userId: string, audit: AuditContext) {
    return this.setActive(actor, userId, true, null, audit)
  }

  /**
   * `POST /platform/users/:id/impersonate` (root): a 30-minute access token of
   * the account, without refresh token, named after the admin. Never for a
   * platform admin or a banned account.
   */
  async impersonate(actor: User, userId: string, reason: string, audit: AuditContext) {
    const target = await platformUsers.find(userId)
    if (!target) throw new AppException('E_NOT_FOUND')
    if (target.id === actor.id) throw conflict('self', 'validation.platform.self')
    if (!target.canAuthenticate) throw conflict('banned', 'validation.platform.banned')
    if (await platformAdmins.isActive(target.id)) {
      throw conflict('platformAdmin', 'validation.platform.platformAdmin')
    }
    const expiresAt = DateTime.now().plus({ minutes: IMPERSONATION_MINUTES })
    const token = await User.accessTokens.create(target, ['*'], {
      name: `${IMPERSONATION_PREFIX}${actor.id}`,
      expiresIn: `${IMPERSONATION_MINUTES}m`,
    })
    await db.transaction((trx) =>
      auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: ROOT_ROLE },
        {
          action: 'impersonation.started',
          targetType: 'user',
          targetId: target.id,
          after: { reason, expiresAt: expiresAt.toUTC().toISO() },
        }
      )
    )
    return {
      accessToken: token.value!.release(),
      expiresIn: IMPERSONATION_MINUTES * 60,
      expiresAt,
      user: target,
    }
  }

  private async setActive(
    actor: User,
    userId: string,
    active: boolean,
    reason: string | null,
    audit: AuditContext
  ) {
    return db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .where('id', userId)
        .whereNull('deleted_at')
        .forUpdate()
        .first()
      if (!user) throw new AppException('E_NOT_FOUND')
      if (user.isActive === active) {
        throw conflict(
          active ? 'notBanned' : 'alreadyBanned',
          `validation.platform.${active ? 'notBanned' : 'alreadyBanned'}`
        )
      }
      user.isActive = active
      await user.useTransaction(trx).save()
      // Every session ends with the ban: access and refresh tokens.
      if (!active) await refreshTokens.revokeAll(user.id, trx)
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: ROOT_ROLE },
        {
          action: active ? 'user.unbanned' : 'user.banned',
          targetType: 'user',
          targetId: user.id,
          after: active ? { isActive: true } : { isActive: false, reason },
        }
      )
      return user
    })
  }
}

export default new PlatformUserService()
