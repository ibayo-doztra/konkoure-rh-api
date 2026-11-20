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

export interface ExportFilters {
  /** ISO instants, inclusive. */
  from: string
  to: string
  employeeId?: string
  source?: PunchSource
  anomaly?: PunchAnomaly
}

export interface ExportCursor {
  punchedAt: Date
  id: string
}

export interface ExportRow {
  id: string
  employeeNumber: string | null
  firstName: string
  lastName: string
  type: PunchType
  punchedAt: Date
  source: PunchSource
  zoneName: string | null
  isWithinZone: boolean
  anomaly: PunchAnomaly | null
  notes: string | null
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

  /** Punches of the employee in `[from, to[`, oldest first (attendance aggregate). */
  ofEmployeeBetween(employeeId: string, from: string, to: string) {
    return this.query()
      .where('employee_id', employeeId)
      .where('punched_at', '>=', from)
      .where('punched_at', '<', to)
      .orderBy('punched_at', 'asc')
      .orderBy('id', 'asc')
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

  /** Export rows (`[from, to]` required), joined with the employee and the zone. */
  private exportQuery(filters: ExportFilters) {
    const query = this.trx
      .from('time_logs as t')
      .join('employees as e', 'e.id', 't.employee_id')
      .leftJoin('work_zones as z', 'z.id', 't.work_zone_id')
      .where('t.organization_id', this.organizationId)
      .where('e.organization_id', this.organizationId)
      .whereNull('e.deleted_at')
      .where('t.punched_at', '>=', filters.from)
      .where('t.punched_at', '<=', filters.to)
    if (filters.employeeId) query.where('t.employee_id', filters.employeeId)
    if (filters.source) query.where('t.source', filters.source)
    if (filters.anomaly) query.where('t.anomaly', filters.anomaly)
    return query
  }

  async exportCount(filters: ExportFilters): Promise<number> {
    const row = await this.exportQuery(filters).count('* as total').first()
    return Number(row?.total ?? 0)
  }

  /** Keyset page after `after` (`punched_at`, `id`): an offset would crawl on a million rows. */
  exportPage(
    filters: ExportFilters,
    after: ExportCursor | null,
    limit: number
  ): Promise<ExportRow[]> {
    const query = this.exportQuery(filters)
    if (after) query.whereRaw('(t.punched_at, t.id) > (?, ?)', [after.punchedAt, after.id])
    return query
      .orderBy('t.punched_at', 'asc')
      .orderBy('t.id', 'asc')
      .limit(limit)
      .select(
        't.id',
        'e.employee_number as employeeNumber',
        'e.first_name as firstName',
        'e.last_name as lastName',
        't.type',
        't.punched_at as punchedAt',
        't.source',
        'z.name as zoneName',
        't.is_within_zone as isWithinZone',
        't.anomaly',
        't.notes'
      )
  }

  async remove(log: TimeLog) {
    await this.query().where('id', log.id).delete()
  }
}

export function timeLogsIn(organizationId: string, trx: TransactionClientContract) {
  return new TimeLogRepository(organizationId, trx)
}
