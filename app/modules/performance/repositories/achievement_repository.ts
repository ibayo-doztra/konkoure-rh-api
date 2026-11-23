import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Achievement from '#models/achievement'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface AchievementListFilters {
  page: number
  perPage: number
  employeeId?: string
  goalId?: string
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

/** Tenant-scoped achievements; those of deleted employees stay hidden. */
export class AchievementRepository extends TenantRepository<typeof Achievement> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Achievement, organizationId, trx)
  }

  protected override query() {
    return super
      .query()
      .where((query) =>
        query
          .whereNull('employee_id')
          .orWhereIn(
            'employee_id',
            this.trx
              .from('employees')
              .where('organization_id', this.organizationId)
              .whereNull('deleted_at')
              .select('id')
          )
      )
  }

  create(data: Partial<ModelAttributes<Achievement>>) {
    return Achievement.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  paginate(filters: AchievementListFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.goalId) query.where('goal_id', filters.goalId)
    return query
      .orderBy('achieved_at', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }
}

export function achievementsIn(organizationId: string, trx: TransactionClientContract) {
  return new AchievementRepository(organizationId, trx)
}
