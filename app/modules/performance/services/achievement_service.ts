import { DateTime } from 'luxon'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { achievementsIn } from '#modules/performance/repositories/achievement_repository'
import { goalsIn } from '#modules/performance/repositories/goal_repository'
import { isInViewerTeam, visibleEmployeeIds } from '#modules/performance/scope'

export interface AchievementInput {
  title: string
  description?: string | null
  impact?: string | null
  achievedAt: DateTime
  goalId?: string | null
}

export interface AchievementListQuery {
  page?: number
  perPage?: number
  filter?: { employeeId?: string; goalId?: string }
}

/** Achievements (docs/backend/06 §9): self · M(team) · O H. */
export class AchievementService {
  list(tenant: TenantContext, query: AchievementListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const page = await achievementsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        ...query.filter,
        employeeIds: await visibleEmployeeIds(tenant, trx),
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  inTeam(tenant: TenantContext, employeeId: string) {
    return withTenant(tenant.organizationId, (trx) => isInViewerTeam(tenant, trx, employeeId))
  }

  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => achievementsIn(organizationId, trx).findOrFail(id))
  }

  /** A linked goal must be one of the employee's goals. */
  create(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    input: AchievementInput,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      if (!(await employeesIn(organizationId, trx).find(employeeId))) {
        throw AppException.validation('employeeId', 'exists', 'validation.performance.employee')
      }
      if (input.goalId) {
        const goal = await goalsIn(organizationId, trx).find(input.goalId)
        if (!goal || goal.employeeId !== employeeId) {
          throw AppException.validation('goalId', 'exists', 'validation.performance.goal')
        }
      }
      const achievement = await achievementsIn(organizationId, trx).create({
        ...input,
        goalId: input.goalId ?? null,
        employeeId,
        createdBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'achievement.created',
        targetType: 'achievement',
        targetId: achievement.id,
        after: { employeeId, goalId: input.goalId ?? null },
      })
      await achievement.refresh()
      return achievement
    })
  }

  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const achievements = achievementsIn(organizationId, trx)
      const achievement = await achievements.findForUpdate(id)
      if (!achievement) throw new AppException('E_NOT_FOUND')
      achievement.merge({ deletedAt: DateTime.now() })
      await achievements.save(achievement)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'achievement.deleted',
        targetType: 'achievement',
        targetId: id,
        before: { employeeId: achievement.employeeId, title: achievement.title },
      })
    })
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new AchievementService()
