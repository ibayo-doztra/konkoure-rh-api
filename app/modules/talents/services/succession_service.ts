import type User from '#models/user'
import type SuccessionPlan from '#models/succession_plan'
import type { SuccessionReadiness } from '#models/succession_plan'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import {
  successionPlansIn,
  type SuccessionListFilters,
} from '#modules/talents/repositories/succession_repository'

export interface SuccessionInput {
  positionTitle?: string
  currentEmployeeId?: string | null
  successorEmployeeId?: string | null
  readiness?: SuccessionReadiness | null
  notes?: string | null
}

export interface SuccessionView {
  plan: SuccessionPlan
  names: Map<string, string>
}

const snapshot = (plan: SuccessionPlan) => ({
  positionTitle: plan.positionTitle,
  currentEmployeeId: plan.currentEmployeeId,
  successorEmployeeId: plan.successorEmployeeId,
  readiness: plan.readiness,
})

/** Succession plans of key positions (docs/backend/02 §8, owner and hr_admin). */
export class SuccessionService {
  list(tenant: TenantContext, filters: SuccessionListFilters) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const page = await successionPlansIn(organizationId, trx).paginate(filters)
      const names = await this.namesOf(organizationId, trx, page.all())
      return { page, names }
    })
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: SuccessionInput & { positionTitle: string },
    audit: AuditContext
  ): Promise<SuccessionView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      await this.assertEmployees(organizationId, trx, input)
      const plan = await successionPlansIn(organizationId, trx).create({
        positionTitle: input.positionTitle,
        currentEmployeeId: input.currentEmployeeId ?? null,
        successorEmployeeId: input.successorEmployeeId ?? null,
        readiness: input.readiness ?? null,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'succession_plan.created',
        targetType: 'succession_plan',
        targetId: plan.id,
        after: snapshot(plan),
      })
      await plan.refresh()
      return { plan, names: await this.namesOf(organizationId, trx, [plan]) }
    })
  }

  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: SuccessionInput,
    audit: AuditContext
  ): Promise<SuccessionView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const plans = successionPlansIn(organizationId, trx)
      const plan = await plans.findForUpdate(id)
      if (!plan) throw new AppException('E_NOT_FOUND')
      await this.assertEmployees(organizationId, trx, input)

      const before = snapshot(plan)
      if (input.positionTitle !== undefined) plan.positionTitle = input.positionTitle
      if (input.currentEmployeeId !== undefined) plan.currentEmployeeId = input.currentEmployeeId
      if (input.successorEmployeeId !== undefined) {
        plan.successorEmployeeId = input.successorEmployeeId
      }
      if (input.readiness !== undefined) plan.readiness = input.readiness
      if (input.notes !== undefined) plan.notes = input.notes
      plan.updatedBy = actor.id
      await plans.save(plan)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'succession_plan.updated',
        targetType: 'succession_plan',
        targetId: id,
        before,
        after: snapshot(plan),
      })
      await plan.refresh()
      return { plan, names: await this.namesOf(organizationId, trx, [plan]) }
    })
  }

  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const plans = successionPlansIn(organizationId, trx)
      const plan = await plans.findForUpdate(id)
      if (!plan) throw new AppException('E_NOT_FOUND')
      await plans.remove(plan)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'succession_plan.deleted',
        targetType: 'succession_plan',
        targetId: id,
        before: snapshot(plan),
      })
    })
  }

  /** Both employees must be live records of the organization. */
  private async assertEmployees(
    organizationId: string,
    trx: TransactionClientContract,
    input: SuccessionInput
  ) {
    const fields = ['currentEmployeeId', 'successorEmployeeId'] as const
    const wanted = fields.flatMap((field) => {
      const id = input[field]
      return id ? [{ field, id }] : []
    })
    if (wanted.length === 0) return
    const known = await employeesIn(organizationId, trx).namesOf(wanted.map((item) => item.id))
    const missing = wanted.find((item) => !known.has(item.id))
    if (missing) {
      throw AppException.validation(missing.field, 'exists', 'validation.employee.notFound')
    }
  }

  private namesOf(organizationId: string, trx: TransactionClientContract, plans: SuccessionPlan[]) {
    const ids = plans.flatMap((plan) =>
      [plan.currentEmployeeId, plan.successorEmployeeId].filter((id): id is string => id !== null)
    )
    return employeesIn(organizationId, trx).namesOf([...new Set(ids)])
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new SuccessionService()
