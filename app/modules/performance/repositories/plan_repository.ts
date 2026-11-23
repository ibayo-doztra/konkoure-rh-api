import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import PerformancePlan, { type PlanStatus } from '#models/performance_plan'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped goal plans. */
export class PlanRepository extends TenantRepository<typeof PerformancePlan> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(PerformancePlan, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<PerformancePlan>>) {
    return PerformancePlan.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  paginate(filters: { page: number; perPage: number; status?: PlanStatus }) {
    const query = this.query()
    if (filters.status) query.where('status', filters.status)
    return query
      .orderBy('period_start', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }
}

export function plansIn(organizationId: string, trx: TransactionClientContract) {
  return new PlanRepository(organizationId, trx)
}
