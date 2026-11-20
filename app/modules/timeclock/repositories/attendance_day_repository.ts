import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AttendanceDay, { type AttendanceAnomaly } from '#models/attendance_day'
import { TenantRepository } from '#shared/base/tenant_repository'
import { newId } from '#shared/utils/crypto'
import type { DayAggregate } from '#modules/timeclock/attendance_rules'

export interface AttendanceFilters {
  page: number
  perPage: number
  employeeId?: string
  /** ISO dates, inclusive. */
  from: string
  to: string
  anomaly?: AttendanceAnomaly
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

/** Tenant-scoped daily aggregates; those of deleted employee records stay hidden. */
export class AttendanceDayRepository extends TenantRepository<typeof AttendanceDay> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(AttendanceDay, organizationId, trx)
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

  /** Writes the aggregate of a day, whatever was there before (idempotent). */
  async upsert(employeeId: string, day: string, aggregate: DayAggregate) {
    const values = {
      first_in: aggregate.firstIn?.toJSDate() ?? null,
      last_out: aggregate.lastOut?.toJSDate() ?? null,
      worked_minutes: aggregate.workedMinutes,
      punch_count: aggregate.punchCount,
      is_complete: aggregate.isComplete,
      anomaly: aggregate.anomaly,
    }
    await this.trx
      .table('attendance_days')
      .insert({
        id: newId(),
        organization_id: this.organizationId,
        employee_id: employeeId,
        day,
        ...values,
      })
      .onConflict(['employee_id', 'day'])
      .merge(values)
  }

  /** A day left without any punch (deleted or moved) has no aggregate. */
  async deleteDay(employeeId: string, day: string) {
    await this.trx
      .from('attendance_days')
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .where('day', day)
      .delete()
  }

  /** Employees whose aggregate of `day` is not complete yet (`attendance:close-day`). */
  async incompleteEmployeeIds(day: string): Promise<string[]> {
    const rows = await this.trx
      .from('attendance_days')
      .where('organization_id', this.organizationId)
      .where('day', day)
      .where('is_complete', false)
      .select('employee_id')
    return rows.map((row: { employee_id: string }) => row.employee_id)
  }

  forDay(day: string, employeeIds?: string[]) {
    const query = this.query().where('day', day)
    if (employeeIds) query.whereIn('employee_id', employeeIds)
    return query
  }

  paginate(filters: AttendanceFilters) {
    const query = this.query().where('day', '>=', filters.from).where('day', '<=', filters.to)
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.anomaly) query.where('anomaly', filters.anomaly)
    return query
      .orderBy('day', 'desc')
      .orderBy('employee_id', 'asc')
      .paginate(filters.page, filters.perPage)
  }
}

export function attendanceDaysIn(organizationId: string, trx: TransactionClientContract) {
  return new AttendanceDayRepository(organizationId, trx)
}
