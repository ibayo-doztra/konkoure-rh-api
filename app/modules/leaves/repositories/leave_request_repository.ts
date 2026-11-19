import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import LeaveRequest, { type LeaveStatus, type LeaveType } from '#models/leave_request'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface LeaveListFilters {
  page: number
  perPage: number
  employeeId?: string
  status?: LeaveStatus
  type?: LeaveType
  /** Leaves overlapping `[from, to]` (ISO dates). */
  from?: string
  to?: string
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

/** Tenant-scoped leave requests; those of deleted employee records stay hidden. */
export class LeaveRequestRepository extends TenantRepository<typeof LeaveRequest> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(LeaveRequest, organizationId, trx)
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

  create(data: Partial<ModelAttributes<LeaveRequest>>) {
    return LeaveRequest.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  /**
   * Serializes every leave mutation of one employee (overlap check, balance),
   * until the end of the transaction.
   */
  async lockEmployee(employeeId: string) {
    await this.trx.rawQuery(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `leave:${employeeId}`,
    ])
  }

  /** A pending or approved leave of the employee sharing at least one day (07 §3.2). */
  async overlaps(employeeId: string, startDate: string, endDate: string, exceptId?: string) {
    const query = this.query()
      .where('employee_id', employeeId)
      .whereIn('status', ['pending', 'approved'])
      .where('start_date', '<=', endDate)
      .where('end_date', '>=', startDate)
    if (exceptId) query.whereNot('id', exceptId)
    return (await query.first()) !== null
  }

  paginate(filters: LeaveListFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.status) query.where('status', filters.status)
    if (filters.type) query.where('type', filters.type)
    if (filters.from) query.where('end_date', '>=', filters.from)
    if (filters.to) query.where('start_date', '<=', filters.to)
    return query
      .orderBy('start_date', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }
}

export function leaveRequestsIn(organizationId: string, trx: TransactionClientContract) {
  return new LeaveRequestRepository(organizationId, trx)
}
