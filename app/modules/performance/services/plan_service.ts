import { DateTime } from 'luxon'
import type User from '#models/user'
import type PerformancePlan from '#models/performance_plan'
import type { PlanStatus } from '#models/performance_plan'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { plansIn } from '#modules/performance/repositories/plan_repository'
import { goalsIn } from '#modules/performance/repositories/goal_repository'

export interface PlanInput {
  name?: string
  periodStart?: DateTime
  periodEnd?: DateTime
  status?: PlanStatus
}

function defined<T extends object>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/** Goal plans (docs/backend/06 §9, settings screens). */
export class PlanService {
  list(tenant: TenantContext, filters: { page: number; perPage: number; status?: PlanStatus }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => plansIn(organizationId, trx).paginate(filters))
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: PlanInput & { name: string; periodStart: DateTime; periodEnd: DateTime },
    audit: AuditContext
  ): Promise<PerformancePlan> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      this.assertPeriod(input.periodStart, input.periodEnd)
      const plan = await plansIn(organizationId, trx).create({
        ...defined(input),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'performance_plan.created',
        targetType: 'performance_plan',
        targetId: plan.id,
        after: { name: input.name, status: input.status ?? 'draft' },
      })
      await plan.refresh()
      return plan
    })
  }

  /** Activating a plan re-checks the weight budget of every employee (07 §5.2). */
  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: PlanInput,
    audit: AuditContext
  ): Promise<PerformancePlan> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const plans = plansIn(organizationId, trx)
      const plan = await plans.findForUpdate(id)
      if (!plan) throw new AppException('E_NOT_FOUND')
      const changes = defined(input)
      this.assertPeriod(
        changes.periodStart ?? plan.periodStart,
        changes.periodEnd ?? plan.periodEnd
      )
      if (changes.status === 'active' && plan.status !== 'active') {
        if (await goalsIn(organizationId, trx).planOverflows(id)) {
          throw new AppException('E_WEIGHT_OVERFLOW', {
            details: [
              { field: 'status', rule: 'weight', message: 'validation.performance.planOverflow' },
            ],
          })
        }
      }
      const before = { status: plan.status }
      plan.merge({ ...changes, updatedBy: actor.id })
      await plans.save(plan)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'performance_plan.updated',
        targetType: 'performance_plan',
        targetId: id,
        before,
        after: { status: plan.status, changedFields: Object.keys(changes) },
      })
      await plan.refresh()
      return plan
    })
  }

  /** Soft delete: goals keep their link to the plan. */
  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const plans = plansIn(organizationId, trx)
      const plan = await plans.findForUpdate(id)
      if (!plan) throw new AppException('E_NOT_FOUND')
      plan.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await plans.save(plan)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'performance_plan.deleted',
        targetType: 'performance_plan',
        targetId: id,
        before: { name: plan.name, status: plan.status },
      })
    })
  }

  private assertPeriod(start: DateTime, end: DateTime) {
    if (end < start) {
      throw AppException.validation('periodEnd', 'afterStart', 'validation.performance.periodEnd')
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new PlanService()
