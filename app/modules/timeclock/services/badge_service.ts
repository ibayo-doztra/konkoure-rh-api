import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import env from '#start/env'
import type User from '#models/user'
import type NfcBadge from '#models/nfc_badge'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { badgesIn, type BadgeRepository } from '#modules/timeclock/repositories/badge_repository'
import { maskUid, normalizeUid, uidHash } from '#modules/timeclock/timeclock_rules'

/** Canonical UID, its lookup hash and masked form; a raw UID never goes further. */
export function badgeIdentity(raw: string) {
  const normalized = normalizeUid(raw)
  if (!normalized) return null
  return {
    hash: uidHash(normalized, env.get('NFC_UID_PEPPER').release()),
    masked: maskUid(normalized),
  }
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23505'

/** NFC badges of employees (docs/backend/06 §6, 07 §2.2, 05 §6). */
export class BadgeService {
  current(tenant: TenantContext, employeeId: string): Promise<NfcBadge | null> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      if (!(await employeesIn(organizationId, trx).find(employeeId))) {
        throw new AppException('E_NOT_FOUND')
      }
      return badgesIn(organizationId, trx).currentOf(employeeId)
    })
  }

  /**
   * Assigns a badge; the employee's previous badge is revoked (`reassigned`).
   * A badge active anywhere else is refused by the global unique index.
   */
  assign(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    rawUid: string,
    audit: AuditContext
  ): Promise<NfcBadge> {
    const identity = badgeIdentity(rawUid)
    if (!identity) {
      throw AppException.validation('badgeUid', 'format', 'validation.timeclock.badgeUid')
    }
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const employee = await employeesIn(organizationId, trx).find(employeeId)
      if (!employee) throw new AppException('E_NOT_FOUND')
      if (employee.status === 'terminated') {
        throw new AppException('E_CONFLICT', {
          details: [
            {
              field: 'employeeId',
              rule: 'terminated',
              message: 'validation.timeclock.employeeTerminated',
            },
          ],
        })
      }
      const badges = badgesIn(organizationId, trx)
      const previous = await badges.currentOfForUpdate(employeeId)
      if (previous) await this.revoke(badges, previous, actor, audit, 'reassigned')

      let badge: NfcBadge
      try {
        badge = await trx.transaction((nested) =>
          badgesIn(organizationId, nested).create({
            employeeId,
            uidHash: identity.hash,
            uidMasked: identity.masked,
            assignedBy: actor.id,
            assignedAt: DateTime.now(),
          })
        )
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        throw new AppException('E_CONFLICT', {
          details: [
            { field: 'badgeUid', rule: 'badgeTaken', message: 'validation.timeclock.badgeTaken' },
          ],
        })
      }
      await badges.record({
        employeeId,
        badgeId: badge.id,
        uidMasked: identity.masked,
        event: 'assigned',
        actorUserId: actor.id,
        ip: audit.ip ?? null,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'badge.assigned',
        targetType: 'employee',
        targetId: employeeId,
        after: { badgeId: badge.id, uid: identity.masked, replaced: previous?.uidMasked ?? null },
      })
      await badge.refresh()
      return badge
    })
  }

  async revokeOf(tenant: TenantContext, actor: User, employeeId: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      if (!(await employeesIn(organizationId, trx).find(employeeId))) {
        throw new AppException('E_NOT_FOUND')
      }
      const badges = badgesIn(organizationId, trx)
      const badge = await badges.currentOfForUpdate(employeeId)
      if (!badge) throw new AppException('E_NOT_FOUND')
      await this.revoke(badges, badge, actor, audit, 'revoked')
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'badge.revoked',
        targetType: 'employee',
        targetId: employeeId,
        before: { badgeId: badge.id, uid: badge.uidMasked },
      })
    })
  }

  /** End of employment (07 §1.5), inside the transaction of the employee update. */
  async revokeAllOf(
    trx: TransactionClientContract,
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    audit: AuditContext
  ) {
    const badges = badgesIn(tenant.organizationId, trx)
    const badge = await badges.currentOfForUpdate(employeeId)
    if (!badge) return
    await this.revoke(badges, badge, actor, audit, 'revoked', 'employment_ended')
  }

  events(tenant: TenantContext, query: { page?: number; perPage?: number; employeeId?: string }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) =>
      badgesIn(organizationId, trx).events({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        employeeId: query.employeeId,
      })
    )
  }

  private async revoke(
    badges: BadgeRepository,
    badge: NfcBadge,
    actor: User,
    audit: AuditContext,
    event: 'revoked' | 'reassigned',
    reason: string | null = null
  ) {
    badge.merge({ revokedAt: DateTime.now(), isActive: false })
    await badges.save(badge)
    await badges.record({
      employeeId: badge.employeeId,
      badgeId: badge.id,
      uidMasked: badge.uidMasked,
      event,
      reason,
      actorUserId: actor.id,
      ip: audit.ip ?? null,
    })
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new BadgeService()
