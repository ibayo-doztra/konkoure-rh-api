import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Goal from '#models/goal'
import type { GoalCategory, GoalStatus } from '#models/goal'
import type { GoalActivityStatus } from '#models/goal_activity'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { plansIn } from '#modules/performance/repositories/plan_repository'
import { goalsIn, type GoalRepository } from '#modules/performance/repositories/goal_repository'
import { isInViewerTeam, visibleEmployeeIds } from '#modules/performance/scope'
import { isWeighted, MAX_PLAN_WEIGHT, statusForProgress } from '#modules/performance/goal_rules'

export interface GoalInput {
  title?: string
  description?: string | null
  measurement?: string | null
  category?: GoalCategory
  weight?: number
  startDate?: DateTime | null
  dueDate?: DateTime | null
  planId?: string | null
  parentGoalId?: string | null
  ownerId?: string | null
}

/** Statuses set by hand: `achieved` follows the progress, `late` the nightly job. */
export type WritableGoalStatus = Extract<GoalStatus, 'not_started' | 'in_progress' | 'cancelled'>

export interface GoalListQuery {
  page?: number
  perPage?: number
  filter?: { employeeId?: string; planId?: string; status?: GoalStatus; category?: GoalCategory }
}

export interface ActivityInput {
  title: string
  description?: string | null
  status?: GoalActivityStatus
  plannedDate?: DateTime | null
  employeeId?: string | null
}

function defined<T extends object>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

const overflow = () =>
  new AppException('E_WEIGHT_OVERFLOW', {
    details: [{ field: 'weight', rule: 'max', message: 'validation.performance.weightOverflow' }],
  })

/** Goals and their activities (docs/backend/06 §9, 07 §5.2). */
export class GoalService {
  list(tenant: TenantContext, query: GoalListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const page = await goalsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        ...query.filter,
        employeeIds: await visibleEmployeeIds(tenant, trx),
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  /** A goal and whether its holder is in the viewer's team, for the policy. */
  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const goal = await goalsIn(organizationId, trx).findOrFail(id)
      return { goal, inTeam: await isInViewerTeam(tenant, trx, goal.employeeId) }
    })
  }

  /** Whether an employee of the organization is in the viewer's team (create policy). */
  inTeam(tenant: TenantContext, employeeId: string) {
    return withTenant(tenant.organizationId, (trx) => isInViewerTeam(tenant, trx, employeeId))
  }

  create(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    input: GoalInput & { title: string },
    audit: AuditContext
  ): Promise<Goal> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const goals = goalsIn(organizationId, trx)
      const employees = employeesIn(organizationId, trx)
      if (!(await employees.find(employeeId))) {
        throw AppException.validation('employeeId', 'exists', 'validation.performance.employee')
      }
      if (input.ownerId && !(await employees.find(input.ownerId))) {
        throw AppException.validation('ownerId', 'exists', 'validation.performance.employee')
      }
      this.assertDates(input.startDate ?? null, input.dueDate ?? null)
      if (input.parentGoalId && !(await goals.find(input.parentGoalId))) {
        throw AppException.validation('parentGoalId', 'exists', 'validation.performance.parent')
      }
      if (input.planId) {
        await this.assertWeight(trx, goals, input.planId, employeeId, input.weight ?? 0)
      }

      const goal = await goals.create({
        ...defined(input),
        employeeId,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'goal.created',
        targetType: 'goal',
        targetId: goal.id,
        after: { employeeId, planId: input.planId ?? null, weight: input.weight ?? 0 },
      })
      await goal.refresh()
      return goal
    })
  }

  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: GoalInput & { status?: WritableGoalStatus },
    audit: AuditContext
  ): Promise<Goal> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const goals = goalsIn(organizationId, trx)
      const goal = await goals.findForUpdate(id)
      if (!goal) throw new AppException('E_NOT_FOUND')
      if (input.ownerId && !(await employeesIn(organizationId, trx).find(input.ownerId))) {
        throw AppException.validation('ownerId', 'exists', 'validation.performance.employee')
      }
      this.assertDates(
        input.startDate === undefined ? goal.startDate : input.startDate,
        input.dueDate === undefined ? goal.dueDate : input.dueDate
      )
      if (input.parentGoalId) await this.assertParent(goals, id, input.parentGoalId)

      const { status: requested, ...fields } = input
      const changes: GoalInput & { status?: GoalStatus } = defined(fields)
      if (requested) changes.status = statusForProgress(requested, goal.progress)
      const planId = input.planId === undefined ? goal.planId : input.planId
      const status = changes.status ?? goal.status
      if (planId && goal.employeeId && isWeighted(status)) {
        const weight = input.weight ?? goal.weight
        await this.assertWeight(trx, goals, planId, goal.employeeId, weight, id)
      }

      const before = { status: goal.status, weight: goal.weight, planId: goal.planId }
      goal.merge({ ...changes, updatedBy: actor.id })
      await goals.save(goal)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'goal.updated',
        targetType: 'goal',
        targetId: id,
        before,
        after: { status: goal.status, changedFields: Object.keys(changes) },
      })
      await goal.refresh()
      return goal
    })
  }

  /** Progress by the holder or their manager; the status follows (07 §5.2). */
  progress(
    tenant: TenantContext,
    actor: User,
    id: string,
    progress: number,
    audit: AuditContext
  ): Promise<Goal> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const goals = goalsIn(organizationId, trx)
      const goal = await goals.findForUpdate(id)
      if (!goal) throw new AppException('E_NOT_FOUND')
      if (goal.status === 'cancelled') {
        throw new AppException('E_CONFLICT', {
          details: [
            { field: 'status', rule: 'cancelled', message: 'validation.performance.goalCancelled' },
          ],
        })
      }
      const before = { progress: goal.progress, status: goal.status }
      goal.merge({
        progress,
        status: statusForProgress(goal.status, progress),
        updatedBy: actor.id,
      })
      await goals.save(goal)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'goal.progress_updated',
        targetType: 'goal',
        targetId: id,
        before,
        after: { progress: goal.progress, status: goal.status },
      })
      await goal.refresh()
      return goal
    })
  }

  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const goals = goalsIn(organizationId, trx)
      const goal = await goals.findForUpdate(id)
      if (!goal) throw new AppException('E_NOT_FOUND')
      goal.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await goals.save(goal)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'goal.deleted',
        targetType: 'goal',
        targetId: id,
        before: { employeeId: goal.employeeId, planId: goal.planId, status: goal.status },
      })
    })
  }

  activities(tenant: TenantContext, goalId: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => goalsIn(organizationId, trx).activitiesOf(goalId))
  }

  addActivity(
    tenant: TenantContext,
    actor: User,
    goalId: string,
    input: ActivityInput,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const goals = goalsIn(organizationId, trx)
      if (!(await goals.find(goalId))) throw new AppException('E_NOT_FOUND')
      if (input.employeeId && !(await employeesIn(organizationId, trx).find(input.employeeId))) {
        throw AppException.validation('employeeId', 'exists', 'validation.performance.employee')
      }
      const activity = await goals.createActivity({
        ...defined(input),
        goalId,
        completedAt: input.status === 'done' ? DateTime.now() : null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'goal.activity_created',
        targetType: 'goal',
        targetId: goalId,
        after: { activityId: activity.id, status: input.status ?? 'planned' },
      })
      await activity.refresh()
      return activity
    })
  }

  /**
   * `goals:mark-late` (docs/backend/08 §2): open goals past their due date in
   * the organization's time zone become `late`. One failing organization does
   * not stop the others.
   */
  async markLate(at: DateTime = DateTime.now()) {
    let marked = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        marked += await withTenant(organizationId, async (trx) => {
          const organization = await organizations.findActive(organizationId, trx)
          if (!organization) return 0
          const today = at.setZone(organization.timezone).toISODate()!
          return goalsIn(organizationId, trx).markLate(today)
        })
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'goals.mark_late_failed')
      }
    }
    logger.info({ marked, failed: failed.length }, 'goals.mark_late_done')
    if (failed.length > 0) {
      throw new Error(`goals:mark-late failed for ${failed.length} organization(s)`)
    }
    return marked
  }

  /**
   * The plan must exist; on an active plan the employee's goals weigh at most
   * 100 (07 §5.2). The plan row lock serializes with its activation.
   */
  private async assertWeight(
    trx: TransactionClientContract,
    goals: GoalRepository,
    planId: string,
    employeeId: string,
    weight: number,
    excludeId?: string
  ) {
    const plan = await plansIn(goals.organizationId, trx).findForUpdate(planId)
    if (!plan) throw AppException.validation('planId', 'exists', 'validation.performance.plan')
    if (plan.status !== 'active') return
    await goals.lockWeights(planId, employeeId)
    const allotted = await goals.weightOf(planId, employeeId, excludeId)
    if (allotted + weight > MAX_PLAN_WEIGHT) throw overflow()
  }

  private async assertParent(goals: GoalRepository, id: string, parentId: string) {
    if (!(await goals.find(parentId))) {
      throw AppException.validation('parentGoalId', 'exists', 'validation.performance.parent')
    }
    const ancestors = await goals.ancestorIds(parentId)
    if (ancestors.includes(id)) {
      throw AppException.validation('parentGoalId', 'cycle', 'validation.performance.parentCycle')
    }
  }

  private assertDates(start: DateTime | null, due: DateTime | null) {
    if (start && due && due < start) {
      throw AppException.validation('dueDate', 'afterStart', 'validation.performance.dueDate')
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new GoalService()
