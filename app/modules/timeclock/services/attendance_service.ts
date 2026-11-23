import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import redis from '@adonisjs/redis/services/main'
import type { AttendanceAnomaly } from '#models/attendance_day'
import queueService from '#shared/queue/queue_service'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { leaveRequestsIn } from '#modules/leaves/repositories/leave_request_repository'
import { holidaysIn } from '#modules/leaves/repositories/holiday_repository'
import { attendanceDaysIn } from '#modules/timeclock/repositories/attendance_day_repository'
import { timeLogsIn } from '#modules/timeclock/repositories/time_log_repository'
import { aggregateDay, dayBounds, localDay } from '#modules/timeclock/attendance_rules'
import { visibleEmployeeIds } from '#modules/timeclock/scope'

/** Recompute delay after a punch (07 §2.8): a burst of punches costs one recompute. */
const DEBOUNCE_MS = 60_000
/** Days waiting for a recompute, `<organizationId>|<employeeId>|<day>`; drained by consolidate. */
const DIRTY_KEY = 'attendance:dirty'
const CONSOLIDATE_BATCH = 500
/** Longest `/attendance` range, in days (lot 2 decision). */
export const MAX_ATTENDANCE_RANGE_DAYS = 93
const DEFAULT_ATTENDANCE_RANGE_DAYS = 30

export interface AttendanceQuery {
  page?: number
  perPage?: number
  filter?: {
    employeeId?: string
    from?: DateTime
    to?: DateTime
    anomaly?: AttendanceAnomaly
  }
}

/** A punch written or removed: the local days to recompute. */
export interface PunchChange {
  organizationId: string
  employeeId: string
  timezone: string
  instants: DateTime[]
}

const member = (organizationId: string, employeeId: string, day: string) =>
  `${organizationId}|${employeeId}|${day}`

/**
 * Daily attendance (docs/backend/02 §5, 07 §2.8, 08 §2–3): `attendance_days`
 * is recomputed after each punch (debounced), every 15 minutes from the dirty
 * set, and closed at 23:59 local time.
 */
export class AttendanceService {
  /**
   * Recomputes one employee's local day from its punches (idempotent). A day
   * before today, or `closed` explicitly, turns an open pair into `missing_out`.
   */
  recompute(
    organizationId: string,
    employeeId: string,
    day: string,
    options: { closed?: boolean; at?: DateTime } = {}
  ) {
    return withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) return null
      const logs = timeLogsIn(organizationId, trx)
      // Same lock as the punches: a concurrent punch waits, then marks the day again.
      await logs.lockEmployee(employeeId)
      const { start, end } = dayBounds(day, organization.timezone)
      const punches = await logs.ofEmployeeBetween(employeeId, start.toISO()!, end.toISO()!)
      const days = attendanceDaysIn(organizationId, trx)
      if (punches.length === 0) {
        await days.deleteDay(employeeId, day)
        return null
      }
      const today = localDay(options.at ?? DateTime.now(), organization.timezone)
      const aggregate = aggregateDay(punches, { closed: options.closed === true || day < today })
      await days.upsert(employeeId, day, aggregate)
      return aggregate
    })
  }

  /**
   * Called after the commit of a punch, a correction or a deletion. With a
   * worker, the day is put in the dirty set and a debounced job is queued;
   * without one (`sync`), it is recomputed at once. Never throws.
   */
  async punchChanged(change: PunchChange) {
    const days = [...new Set(change.instants.map((at) => localDay(at, change.timezone)))]
    for (const day of days) {
      try {
        if (queueService.driver === 'sync') {
          await this.recompute(change.organizationId, change.employeeId, day)
          continue
        }
        await redis
          .connection('cache')
          .sadd(DIRTY_KEY, member(change.organizationId, change.employeeId, day))
        await queueService.dispatch(
          'attendance.recompute',
          { organizationId: change.organizationId, employeeId: change.employeeId, day },
          {
            jobId: `attendance_${change.organizationId}_${change.employeeId}_${day}`,
            delay: DEBOUNCE_MS,
          }
        )
      } catch (error) {
        // The dirty set or the 15-minute consolidation catches up.
        logger.warn({ err: error, employeeId: change.employeeId, day }, 'attendance.mark_failed')
      }
    }
  }

  /** Debounced job: the marker is taken first, so a punch during the run marks the day again. */
  async runRecompute(payload: { organizationId: string; employeeId: string; day: string }) {
    await redis
      .connection('cache')
      .srem(DIRTY_KEY, member(payload.organizationId, payload.employeeId, payload.day))
    await this.recompute(payload.organizationId, payload.employeeId, payload.day)
  }

  /** `attendance:consolidate` (every 15 min): recomputes every day left in the dirty set. */
  async consolidate() {
    const cache = redis.connection('cache')
    let recomputed = 0
    const failed: string[] = []
    for (;;) {
      const batch = (await cache.spop(DIRTY_KEY, CONSOLIDATE_BATCH)) as string[]
      if (batch.length === 0) break
      for (const entry of batch) {
        const [organizationId, employeeId, day] = entry.split('|')
        try {
          await this.recompute(organizationId, employeeId, day)
          recomputed += 1
        } catch (error) {
          failed.push(entry)
          logger.error(
            { err: error, organizationId, employeeId, day },
            'attendance.recompute_failed'
          )
        }
      }
      if (batch.length < CONSOLIDATE_BATCH) break
    }
    if (failed.length > 0) await cache.sadd(DIRTY_KEY, ...failed)
    logger.info({ recomputed, failed: failed.length }, 'attendance.consolidate_done')
    if (failed.length > 0) {
      throw new Error(`attendance:consolidate failed for ${failed.length} day(s)`)
    }
    return recomputed
  }

  /**
   * `attendance:close-day` (23:59 local): closes the incomplete days of today,
   * and of yesterday to catch up a missed run, which become `missing_out`.
   */
  async closeDay(at: DateTime = DateTime.now()) {
    let closed = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        closed += await this.closeOrganization(organizationId, at)
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'attendance.close_day_failed')
      }
    }
    logger.info({ closed, failed: failed.length }, 'attendance.close_day_done')
    if (failed.length > 0) {
      throw new Error(`attendance:close-day failed for ${failed.length} organization(s)`)
    }
    return closed
  }

  private async closeOrganization(organizationId: string, at: DateTime) {
    const pending = await withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) return []
      const today = localDay(at, organization.timezone)
      const yesterday = DateTime.fromISO(today).minus({ days: 1 }).toISODate()!
      const days = attendanceDaysIn(organizationId, trx)
      const found: Array<{ employeeId: string; day: string }> = []
      for (const day of [yesterday, today]) {
        for (const employeeId of await days.incompleteEmployeeIds(day)) {
          found.push({ employeeId, day })
        }
      }
      return found
    })
    for (const { employeeId, day } of pending) {
      await this.recompute(organizationId, employeeId, day, { closed: true, at })
    }
    return pending.length
  }

  /** GET /org/timeclock/attendance: daily aggregates, scoped like the punch history. */
  list(tenant: TenantContext, query: AttendanceQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      const to = query.filter?.to?.toISODate() ?? localDay(DateTime.now(), organization.timezone)
      const from =
        query.filter?.from?.toISODate() ??
        DateTime.fromISO(to)
          .minus({ days: DEFAULT_ATTENDANCE_RANGE_DAYS - 1 })
          .toISODate()!
      assertRange(from, to, MAX_ATTENDANCE_RANGE_DAYS, 'validation.timeclock.attendanceRange')
      const page = await attendanceDaysIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 50,
        employeeId: query.filter?.employeeId,
        from,
        to,
        anomaly: query.filter?.anomaly,
        employeeIds: await visibleEmployeeIds(tenant, trx),
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  /**
   * GET /org/timeclock/today: present (a punch today), on leave (approved
   * leave or `on_leave`) and absent, among the active staff in scope.
   */
  today(tenant: TenantContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      const scope = await visibleEmployeeIds(tenant, trx)
      return this.board(trx, organizationId, organization.timezone, scope)
    })
  }

  /**
   * Today's board among the employees in `scope` (all when undefined), inside
   * the caller's tenant transaction; also used by the dashboard.
   */
  async board(
    trx: TransactionClientContract,
    organizationId: string,
    timezone: string,
    scope: string[] | undefined
  ) {
    const date = localDay(DateTime.now(), timezone)
    const roster = await employeesIn(organizationId, trx).roster(scope)
    const ids = roster.map((employee) => employee.id)
    const days = await attendanceDaysIn(organizationId, trx).forDay(date, ids)
    const onLeaveIds = new Set(
      await leaveRequestsIn(organizationId, trx).approvedEmployeeIdsOn(date)
    )
    const holidays = await holidaysIn(organizationId, trx).datesWithin(date, date)
    const byEmployee = new Map(days.map((row) => [row.employeeId, row]))

    const present = []
    const absent = []
    const onLeave = []
    for (const employee of roster) {
      const day = byEmployee.get(employee.id)
      if (day) present.push({ employee, day })
      else if (employee.status === 'on_leave' || onLeaveIds.has(employee.id)) {
        onLeave.push(employee)
      } else absent.push(employee)
    }
    return { date, isHoliday: holidays.has(date), present, absent, onLeave }
  }
}

/** `from ≤ to` (ISO dates) and at most `maxDays` days, inclusive. */
export function assertRange(from: string, to: string, maxDays: number, tooLong: string) {
  const span = DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days + 1
  if (span < 1) {
    throw AppException.validation('filter.to', 'afterOrEqual', 'validation.timeclock.range')
  }
  if (span > maxDays) throw AppException.validation('filter.from', 'range', tooLong)
}

export default new AttendanceService()
