import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

/** `undefined`: the whole organization; otherwise these employees only. */
export type Scope = string[] | undefined

export interface Period {
  from: string
  to: string
  start: DateTime
  end: DateTime
}

const num = (value: unknown) => Number(value ?? 0)

/**
 * Aggregates of `GET /org/dashboard` (06 §3): counts and sums computed by
 * PostgreSQL, never rows loaded in memory. It spans several tables, so it is
 * not a model repository, but like them it cannot exist without an
 * organization and the tenant transaction.
 */
export class DashboardRepository {
  constructor(
    readonly organizationId: string,
    private readonly trx: TransactionClientContract
  ) {
    if (!organizationId) throw new Error('A tenant repository requires an organization id')
  }

  /** Live employee records of the organization, within the scope. */
  private employees(scope: Scope) {
    const query = this.trx
      .from('employees')
      .where('organization_id', this.organizationId)
      .whereNull('deleted_at')
    if (scope) query.whereIn('id', scope)
    return query
  }

  private scopeIds(scope: Scope) {
    return this.employees(scope).select('id')
  }

  async headcount(scope: Scope, period: Period) {
    const row = await this.employees(scope)
      .select(
        this.trx.raw(`count(*) FILTER (WHERE status <> 'terminated') AS total`),
        this.trx.raw(`count(*) FILTER (WHERE status = 'active') AS active`),
        this.trx.raw(`count(*) FILTER (WHERE status = 'on_leave') AS on_leave`),
        this.trx.raw(`count(*) FILTER (WHERE hire_date BETWEEN ? AND ?) AS new_hires`, [
          period.from,
          period.to,
        ]),
        this.trx.raw(`count(*) FILTER (WHERE end_date BETWEEN ? AND ?) AS exits`, [
          period.from,
          period.to,
        ])
      )
      .first()
    return {
      total: num(row?.total),
      active: num(row?.active),
      onLeave: num(row?.on_leave),
      newHires: num(row?.new_hires),
      exits: num(row?.exits),
    }
  }

  /** Mean worked hours of the complete days of the period, null without any. */
  async avgWorkedHours(scope: Scope, period: Period): Promise<number | null> {
    const row = await this.trx
      .from('attendance_days')
      .where('organization_id', this.organizationId)
      .whereBetween('day', [period.from, period.to])
      .where('is_complete', true)
      .whereIn('employee_id', this.scopeIds(scope))
      .avg('worked_minutes as minutes')
      .first()
    if (row?.minutes === null || row?.minutes === undefined) return null
    return Math.round((Number(row.minutes) / 60) * 10) / 10
  }

  async outOfZonePunches(scope: Scope, period: Period) {
    const row = await this.trx
      .from('time_logs')
      .where('organization_id', this.organizationId)
      .where('punched_at', '>=', period.start.toJSDate())
      .where('punched_at', '<', period.end.toJSDate())
      .where('anomaly', 'out_of_zone')
      .whereIn('employee_id', this.scopeIds(scope))
      .count('* as total')
      .first()
    return num(row?.total)
  }

  async leaves(scope: Scope, period: Period) {
    const row = await this.trx
      .from('leave_requests')
      .where('organization_id', this.organizationId)
      .whereIn('employee_id', this.scopeIds(scope))
      .select(
        this.trx.raw(`count(*) FILTER (WHERE status = 'pending') AS pending`),
        this.trx.raw(
          `count(*) FILTER (WHERE status = 'approved' AND decided_at >= ? AND decided_at < ?)
             AS approved`,
          [period.start.toJSDate(), period.end.toJSDate()]
        ),
        this.trx.raw(
          `coalesce(sum(requested_days) FILTER (
             WHERE status = 'approved' AND start_date BETWEEN ? AND ?), 0) AS days`,
          [period.from, period.to]
        )
      )
      .first()
    return {
      pending: num(row?.pending),
      approvedThisPeriod: num(row?.approved),
      daysTaken: num(row?.days),
    }
  }

  /**
   * Performance block (06 §3, decision of 2026-11-23): evaluations not signed
   * yet, evaluations signed in the period, mean progress of the live goals
   * that are not cancelled (null without any).
   */
  async performance(scope: Scope, period: Period) {
    const reviews = await this.trx
      .from('performance_reviews')
      .where('organization_id', this.organizationId)
      .whereIn('employee_id', this.scopeIds(scope))
      .select(
        this.trx.raw(`count(*) FILTER (WHERE status <> 'signed') AS in_progress`),
        this.trx.raw(`count(*) FILTER (WHERE signed_at >= ? AND signed_at < ?) AS signed`, [
          period.start.toJSDate(),
          period.end.toJSDate(),
        ])
      )
      .first()
    const goals = await this.trx
      .from('goals')
      .where('organization_id', this.organizationId)
      .whereNull('deleted_at')
      .whereNot('status', 'cancelled')
      .whereIn('employee_id', this.scopeIds(scope))
      .avg('progress as progress')
      .first()
    const progress = goals?.progress
    return {
      reviewsInProgress: num(reviews?.in_progress),
      reviewsSigned: num(reviews?.signed),
      avgGoalProgress:
        progress === null || progress === undefined ? null : Math.round(Number(progress)),
    }
  }

  /** Staff present on `day`: hired by then and not gone before it (previous period). */
  async headcountAt(scope: Scope, day: string) {
    const row = await this.employees(scope)
      .whereRaw('coalesce(hire_date, created_at::date) <= ?', [day])
      .where((query) => query.whereNull('end_date').orWhere('end_date', '>=', day))
      .count('* as total')
      .first()
    return num(row?.total)
  }

  /**
   * Recruitment block (06 §3), whole organization: published offers now,
   * candidates received and hires recorded in the period.
   */
  async recruitment(period: Period) {
    const window = [period.start.toJSDate(), period.end.toJSDate()]
    const jobs = await this.trx
      .from('jobs')
      .where('organization_id', this.organizationId)
      .whereNull('deleted_at')
      .where('status', 'published')
      .count('* as total')
      .first()
    const candidates = await this.trx
      .from('candidates')
      .where('organization_id', this.organizationId)
      .where('created_at', '>=', window[0])
      .where('created_at', '<', window[1])
      .count('* as total')
      .first()
    const hired = await this.trx
      .from('candidate_events')
      .where('organization_id', this.organizationId)
      .where('type', 'stage_changed')
      .whereRaw(`payload->>'to' = 'hired'`)
      .where('created_at', '>=', window[0])
      .where('created_at', '<', window[1])
      .countDistinct('candidate_id as total')
      .first()
    return {
      openJobs: num(jobs?.total),
      newCandidates: num(candidates?.total),
      hired: num(hired?.total),
    }
  }

  /**
   * Payroll (decision of 2026-11-26): sum of the salaries of the contracts in
   * force on `day`, one per live employee (the latest started), in the
   * organization's currency (others are left out, never added up). Today only `active` contracts count; for a past
   * day the current status is unknown then, so any contract but a draft does.
   */
  async payroll(day: string, currency: string, past: boolean) {
    const result = await this.trx.rawQuery(
      `SELECT coalesce(sum(salary), 0) AS total FROM (
         SELECT DISTINCT ON (c.employee_id) c.salary
           FROM contracts c
           JOIN employees e ON e.id = c.employee_id AND e.deleted_at IS NULL
          WHERE c.organization_id = ?
            AND c.currency = ?
            AND c.start_date <= ?
            AND (c.end_date IS NULL OR c.end_date >= ?)
            AND ${past ? `c.status <> 'draft'` : `c.status = 'active'`}
          ORDER BY c.employee_id, c.start_date DESC, c.id DESC
       ) AS current
       WHERE current.salary IS NOT NULL`,
      [this.organizationId, currency, day, day]
    )
    return num(result.rows[0]?.total)
  }

  /** Staff of each month: hired by its end, not gone before it started. */
  async headcountByMonth(scope: Scope, first: string, last: string) {
    const scopeSql = scope ? 'AND e.id = ANY(?::uuid[])' : ''
    const result = await this.trx.rawQuery(
      `SELECT to_char(m, 'YYYY-MM') AS month, count(e.id) AS total
         FROM generate_series(?::date, ?::date, interval '1 month') AS m
         LEFT JOIN employees e
           ON e.organization_id = ?
          AND e.deleted_at IS NULL
          AND coalesce(e.hire_date, e.created_at::date) < m + interval '1 month'
          AND (e.end_date IS NULL OR e.end_date >= m)
          ${scopeSql}
        GROUP BY m
        ORDER BY m`,
      [first, last, this.organizationId, ...(scope ? [scope] : [])]
    )
    return (result.rows as Array<{ month: string; total: string }>).map((row) => ({
      month: row.month,
      total: num(row.total),
    }))
  }

  /** Punches per local day of the period; days without any are left out. */
  async punchesByDay(scope: Scope, period: Period, timezone: string) {
    const rows = await this.trx
      .from('time_logs')
      .where('organization_id', this.organizationId)
      .where('punched_at', '>=', period.start.toJSDate())
      .where('punched_at', '<', period.end.toJSDate())
      .whereIn('employee_id', this.scopeIds(scope))
      .select(this.trx.raw(`to_char(punched_at AT TIME ZONE ?, 'YYYY-MM-DD') AS day`, [timezone]))
      .count('* as count')
      .groupByRaw('1')
      .orderByRaw('1')
    return (rows as Array<{ day: string; count: string }>).map((row) => ({
      day: row.day,
      count: num(row.count),
    }))
  }

  async leavesByType(scope: Scope, period: Period) {
    const rows = await this.trx
      .from('leave_requests')
      .where('organization_id', this.organizationId)
      .where('status', 'approved')
      .whereBetween('start_date', [period.from, period.to])
      .whereIn('employee_id', this.scopeIds(scope))
      .select('type')
      .sum('requested_days as days')
      .groupBy('type')
      .orderBy('type')
    return (rows as Array<{ type: string; days: string }>).map((row) => ({
      type: row.type,
      days: num(row.days),
    }))
  }
}

export function dashboardIn(organizationId: string, trx: TransactionClientContract) {
  return new DashboardRepository(organizationId, trx)
}
