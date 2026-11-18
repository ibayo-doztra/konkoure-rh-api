import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type { AppRole } from '#models/user_role'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import {
  membersIn,
  type MemberRepository,
  type MemberRow,
} from '#modules/organizations/repositories/member_repository'

/** Members and their roles (docs/backend/04 §5, 06 §3). */
export class MemberService {
  list(tenant: TenantContext, filters: { page: number; perPage: number }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => membersIn(organizationId, trx).paginate(filters))
  }

  /** A user who is not a member here, in any organization or none, is 404. */
  find(tenant: TenantContext, userId: string): Promise<MemberRow> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const member = await membersIn(organizationId, trx).findMember(userId)
      if (!member) throw new AppException('E_NOT_FOUND')
      return member
    })
  }

  /** Makes `roles` the complete list held by the member. */
  updateRoles(
    tenant: TenantContext,
    actor: User,
    userId: string,
    roles: AppRole[],
    audit: AuditContext
  ): Promise<MemberRow> {
    return this.mutate(tenant, userId, async (members, member, trx) => {
      this.assertOwnerScope(tenant, [...member.roles, ...roles])
      const added = roles.filter((role) => !member.roles.includes(role))
      const removed = member.roles.filter((role) => !roles.includes(role))
      await this.assertKeepsOwner(members, userId, removed)

      if (removed.length > 0) await members.revoke(userId, removed)
      for (const role of added) await members.grant(userId, role, actor.id)
      await this.auditRoles(trx, tenant, audit, userId, added, removed)

      const updated = await members.findMember(userId)
      if (!updated) throw new AppException('E_NOT_FOUND')
      return updated
    })
  }

  /** Removes every role: the user no longer belongs to the organization. */
  async remove(tenant: TenantContext, userId: string, audit: AuditContext) {
    await this.mutate(tenant, userId, async (members, member, trx) => {
      this.assertOwnerScope(tenant, member.roles)
      await this.assertKeepsOwner(members, userId, member.roles)
      await members.revoke(userId, member.roles)
      await this.auditRoles(trx, tenant, audit, userId, [], member.roles)
    })
  }

  /**
   * Same removal inside a caller's transaction (end of employment, 07 §1.5);
   * a user who is no longer a member is left alone.
   */
  async revokeAllIn(
    trx: TransactionClientContract,
    tenant: TenantContext,
    userId: string,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    if (!(await organizations.findActiveForUpdate(organizationId, trx))) {
      throw new AppException('E_NOT_FOUND')
    }
    const members = membersIn(organizationId, trx)
    const member = await members.findMember(userId)
    if (!member) return
    this.assertOwnerScope(tenant, member.roles)
    await this.assertKeepsOwner(members, userId, member.roles)
    await members.revoke(userId, member.roles)
    await this.auditRoles(trx, tenant, audit, userId, [], member.roles)
  }

  /**
   * Runs under the organization lock, so two concurrent changes can never
   * leave it without an owner, on the member as it is once locked.
   */
  private mutate<T>(
    tenant: TenantContext,
    userId: string,
    change: (
      members: MemberRepository,
      member: MemberRow,
      trx: TransactionClientContract
    ) => Promise<T>
  ): Promise<T> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActiveForUpdate(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      const members = membersIn(organizationId, trx)
      const member = await members.findMember(userId)
      if (!member) throw new AppException('E_NOT_FOUND')
      return change(members, member, trx)
    })
  }

  /** The policy decided on data read before the lock: the owner role may have moved since. */
  private assertOwnerScope(tenant: TenantContext, roles: AppRole[]) {
    if (roles.includes('owner') && !tenant.hasRole('owner')) throw new AppException('E_FORBIDDEN')
  }

  private async assertKeepsOwner(members: MemberRepository, userId: string, removed: AppRole[]) {
    if (!removed.includes('owner') || (await members.hasOtherActiveOwner(userId))) return
    throw new AppException('E_CONFLICT', {
      details: [{ field: 'userId', rule: 'lastOwner', message: 'validation.member.lastOwner' }],
    })
  }

  private async auditRoles(
    trx: TransactionClientContract,
    tenant: TenantContext,
    audit: AuditContext,
    userId: string,
    added: AppRole[],
    removed: AppRole[]
  ) {
    const context = {
      ...audit,
      organizationId: tenant.organizationId,
      actorRole: tenant.primaryRole,
    }
    for (const role of added) {
      await auditService.record(trx, context, {
        action: 'role.granted',
        targetType: 'user',
        targetId: userId,
        after: { role },
      })
    }
    for (const role of removed) {
      await auditService.record(trx, context, {
        action: 'role.revoked',
        targetType: 'user',
        targetId: userId,
        before: { role },
      })
    }
  }
}

export default new MemberService()
