import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Okr, { type OkrReviewStatus, type OkrStatus } from '#models/okr'
import OkrKeyResult from '#models/okr_key_result'
import OkrCheckin from '#models/okr_checkin'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface OkrListFilters {
  page: number
  perPage: number
  employeeId?: string
  quarter?: string
  status?: OkrStatus
  reviewStatus?: OkrReviewStatus
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

export type KeyResultColumns = Pick<
  ModelAttributes<OkrKeyResult>,
  'title' | 'metric' | 'targetValue' | 'currentValue' | 'unit' | 'isDone' | 'doneAt'
>

/** Tenant-scoped OKRs, key results and check-ins; those of deleted employees stay hidden. */
export class OkrRepository extends TenantRepository<typeof Okr> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Okr, organizationId, trx)
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

  create(data: Partial<ModelAttributes<Okr>>) {
    return Okr.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: OkrListFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.quarter) query.where('quarter', filters.quarter)
    if (filters.status) query.where('status', filters.status)
    if (filters.reviewStatus) query.where('review_status', filters.reviewStatus)
    return query
      .orderBy('quarter', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  keyResultsOf(okrIds: string[]) {
    if (okrIds.length === 0) return Promise.resolve([] as OkrKeyResult[])
    return OkrKeyResult.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereIn('okr_id', okrIds)
      .orderBy('okr_id', 'asc')
      .orderBy('position', 'asc')
  }

  countKeyResults(okrId: string) {
    return OkrKeyResult.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('okr_id', okrId)
      .count('* as total')
      .first()
      .then((row) => Number(row?.$extras.total ?? 0))
  }

  /** Replaces the key results in order; the trigger recomputes the progress. */
  async replaceKeyResults(okrId: string, items: KeyResultColumns[]) {
    await OkrKeyResult.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('okr_id', okrId)
      .delete()
    for (const [index, item] of items.entries()) {
      await OkrKeyResult.create(
        { ...item, okrId, position: index + 1, organizationId: this.organizationId },
        { client: this.trx }
      )
    }
  }

  findKeyResultForUpdate(okrId: string, keyResultId: string) {
    return OkrKeyResult.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('okr_id', okrId)
      .where('id', keyResultId)
      .forUpdate()
      .first()
  }

  checkinsOf(okrId: string) {
    return OkrCheckin.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('okr_id', okrId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
  }

  createCheckin(data: Partial<ModelAttributes<OkrCheckin>>) {
    return OkrCheckin.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  /** Validated, active OKRs held by an employee without a check-in since `since` (07 §5.5). */
  withoutCheckinSince(since: DateTime) {
    return this.query()
      .where('review_status', 'validated')
      .where('status', 'active')
      .whereNotNull('employee_id')
      .whereNotExists((query) =>
        query
          .from('okr_checkins')
          .whereColumn('okr_checkins.okr_id', 'okrs.id')
          .where('okr_checkins.created_at', '>=', since.toUTC().toISO()!)
      )
  }
}

export function okrsIn(organizationId: string, trx: TransactionClientContract) {
  return new OkrRepository(organizationId, trx)
}
