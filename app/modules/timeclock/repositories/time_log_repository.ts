import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import TimeLog, { type PunchAnomaly, type PunchSource, type PunchType } from '#models/time_log'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface TimeLogFilters {
  page: number
  perPage: number
  employeeId?: string
  /** ISO instants, inclusive. */
  from?: string
  to?: string
  source?: PunchSource
  anomaly?: PunchAnomaly
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

/** Tenant-scoped punches; those of deleted employee records stay hidden. */
export class TimeLogRepository extends TenantRepository<typeof TimeLog> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(TimeLog, organizationId, trx)
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

  create(data: Partial<ModelAttributes<TimeLog>>) {
    return TimeLog.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  /** Serializes the punches of one employee (type deduction, duplicate window). */
  async lockEmployee(employeeId: string) {
    await this.trx.rawQuery(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `punch:${employeeId}`,
    ])
  }

  /** Latest punch of the employee in `[from, before]` (07 §2.4). */
  latestBetween(employeeId: string, from: string, before: string) {
    return this.query()
      .where('employee_id', employeeId)
      .where('punched_at', '>=', from)
      .where('punched_at', '<=', before)
      .orderBy('punched_at', 'desc')
      .first()
  }

  /** A punch of the same type within the duplicate window (07 §2.5). */
  sameTypeWithin(employeeId: string, type: PunchType, from: string, to: string) {
    return this.query()
      .where('employee_id', employeeId)
      .where('type', type)
      .whereBetween('punched_at', [from, to])
      .first()
  }

  /** The punch already recorded for an offline `clientPunchId`, if any. */
  async findByClientId(employeeId: string, clientPunchId: string) {
    const row = await this.trx
      .from('time_log_client_ids')
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .where('client_punch_id', clientPunchId)
      .first()
    if (!row) return null
    return this.query().where('id', row.time_log_id).first()
  }

  async rememberClientId(log: TimeLog) {
    await this.trx.table('time_log_client_ids').insert({
      employee_id: log.employeeId,
      client_punch_id: log.clientPunchId,
      organization_id: this.organizationId,
      time_log_id: log.id,
      punched_at: log.punchedAt.toJSDate(),
    })
  }

  async forgetClientId(log: TimeLog) {
    if (!log.clientPunchId) return
    await this.trx
      .from('time_log_client_ids')
      .where('organization_id', this.organizationId)
      .where('employee_id', log.employeeId)
      .where('client_punch_id', log.clientPunchId)
      .delete()
  }

  paginate(filters: TimeLogFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.from) query.where('punched_at', '>=', filters.from)
    if (filters.to) query.where('punched_at', '<=', filters.to)
    if (filters.source) query.where('source', filters.source)
    if (filters.anomaly) query.where('anomaly', filters.anomaly)
    return query
      .orderBy('punched_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }

  async remove(log: TimeLog) {
    await this.query().where('id', log.id).delete()
  }
}

export function timeLogsIn(organizationId: string, trx: TransactionClientContract) {
  return new TimeLogRepository(organizationId, trx)
}
