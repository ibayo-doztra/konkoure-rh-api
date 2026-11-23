import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Feedback, { type FeedbackKind } from '#models/feedback'
import { TenantRepository } from '#shared/base/tenant_repository'

/**
 * What a non-HR viewer reads (docs/backend/04 §5): feedback received or sent,
 * plus what the team received when `visible_to_manager`.
 */
export interface FeedbackAudience {
  employeeId: string | null
  userId: string
  team: string[]
}

export interface FeedbackListFilters {
  page: number
  perPage: number
  toEmployeeId?: string
  kind?: FeedbackKind
  /** Undefined for owner and hr_admin, who read everything. */
  audience?: FeedbackAudience
}

/** Tenant-scoped feedback; that of deleted recipients stays hidden. */
export class FeedbackRepository extends TenantRepository<typeof Feedback> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Feedback, organizationId, trx)
  }

  protected override query() {
    return super
      .query()
      .whereIn(
        'to_employee_id',
        this.trx
          .from('employees')
          .where('organization_id', this.organizationId)
          .whereNull('deleted_at')
          .select('id')
      )
  }

  create(data: Partial<ModelAttributes<Feedback>>) {
    return Feedback.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: FeedbackListFilters) {
    const query = this.query()
    const audience = filters.audience
    if (audience) {
      query.where((scope) => {
        scope.where('created_by', audience.userId)
        if (audience.employeeId) {
          scope
            .orWhere('to_employee_id', audience.employeeId)
            .orWhere('from_employee_id', audience.employeeId)
        }
        if (audience.team.length > 0) {
          scope.orWhere((team) =>
            team.whereIn('to_employee_id', audience.team).where('visible_to_manager', true)
          )
        }
      })
    }
    if (filters.toEmployeeId) query.where('to_employee_id', filters.toEmployeeId)
    if (filters.kind) query.where('kind', filters.kind)
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }
}

export function feedbacksIn(organizationId: string, trx: TransactionClientContract) {
  return new FeedbackRepository(organizationId, trx)
}
