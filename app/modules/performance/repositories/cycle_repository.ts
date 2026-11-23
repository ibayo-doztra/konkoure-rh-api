import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import PerformanceCycle, { type CycleStatus } from '#models/performance_cycle'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped evaluation cycles. */
export class CycleRepository extends TenantRepository<typeof PerformanceCycle> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(PerformanceCycle, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<PerformanceCycle>>) {
    return PerformanceCycle.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  paginate(filters: { page: number; perPage: number; status?: CycleStatus }) {
    const query = this.query()
    if (filters.status) query.where('status', filters.status)
    return query
      .orderBy('period_start', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }
}

export function cyclesIn(organizationId: string, trx: TransactionClientContract) {
  return new CycleRepository(organizationId, trx)
}
