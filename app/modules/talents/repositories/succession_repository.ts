import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import SuccessionPlan, { type SuccessionReadiness } from '#models/succession_plan'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface SuccessionListFilters {
  page: number
  perPage: number
  readiness?: SuccessionReadiness
  /** Plans where this employee is the holder or the successor. */
  employeeId?: string
}

/** Tenant-scoped succession plans; no soft delete (nothing references them). */
export class SuccessionRepository extends TenantRepository<typeof SuccessionPlan> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(SuccessionPlan, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<SuccessionPlan>>) {
    return SuccessionPlan.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  paginate(filters: SuccessionListFilters) {
    const query = this.query()
    if (filters.readiness) query.where('readiness', filters.readiness)
    if (filters.employeeId) {
      const id = filters.employeeId
      query.where((match) =>
        match.where('current_employee_id', id).orWhere('successor_employee_id', id)
      )
    }
    return query
      .orderBy('position_title', 'asc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  async remove(plan: SuccessionPlan) {
    plan.useTransaction(this.trx)
    await plan.delete()
  }
}

export function successionPlansIn(organizationId: string, trx: TransactionClientContract) {
  return new SuccessionRepository(organizationId, trx)
}
