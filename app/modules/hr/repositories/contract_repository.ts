import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Contract, { type ContractStatus, type ContractType } from '#models/contract'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface ContractListFilters {
  page: number
  perPage: number
  employeeId?: string
  status?: ContractStatus
  type?: ContractType
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

/** Tenant-scoped contracts; those of deleted employee records stay hidden. */
export class ContractRepository extends TenantRepository<typeof Contract> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Contract, organizationId, trx)
  }

  protected override query() {
    return super
      .query()
      .whereIn(
        'employee_id',
        this.trx
          .from('employees')
          .where('organization_id', this.organizationId)
          .whereNull('deleted_at')
          .select('id')
      )
  }

  create(data: Partial<ModelAttributes<Contract>>) {
    return Contract.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  activeOfForUpdate(employeeId: string) {
    return this.query()
      .where('employee_id', employeeId)
      .where('status', 'active')
      .forUpdate()
      .first()
  }

  paginate(filters: ContractListFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.status) query.where('status', filters.status)
    if (filters.type) query.where('type', filters.type)
    return query
      .orderBy('start_date', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }
}

export function contractsIn(organizationId: string, trx: TransactionClientContract) {
  return new ContractRepository(organizationId, trx)
}
