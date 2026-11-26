import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import entitlementService, {
  accessError,
  type Entitlements,
  type ModuleKey,
} from '#modules/billing/services/entitlement_service'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import attendanceService from '#modules/timeclock/services/attendance_service'
import { dashboardIn, type Scope } from '#modules/dashboard/repositories/dashboard_repository'
import { DateTime } from 'luxon'
import {
  lastTwelveMonths,
  periodBounds,
  previousPeriodBounds,
  type DashboardPeriod,
} from '#modules/dashboard/dashboard_rules'

/** Cache of 06 §3. */
const CACHE_TTL_SECONDS = 5 * 60
/** Bumped when the response shape changes, so no stale shape is served. */
const CACHE_VERSION = 'v2'

export interface Dashboard {
  period: { from: string; to: string }
  headcount: {
    total: number
    active: number
    onLeave: number
    newHires: number
    exits: number
  } | null
  attendance: {
    punctualityRate: number | null
    avgWorkedHours: number | null
    absencesToday: number
    outOfZonePunches: number
  } | null
  leaves: { pending: number; approvedThisPeriod: number; daysTaken: number } | null
  recruitment: { openJobs: number; newCandidates: number; hired: number } | null
  performance: {
    reviewsInProgress: number
    reviewsSigned: number
    avgGoalProgress: number | null
  } | null
  /** owner and hr_admin only (decision of 2026-11-26). */
  payroll: Payroll | null
  previous: PreviousPeriod
  series: {
    headcountByMonth: Array<{ month: string; total: number }> | null
    punchesByDay: Array<{ day: string; count: number }> | null
    leavesByType: Array<{ type: string; days: number }> | null
  }
}

interface Payroll {
  total: number
  currency: string
}

/**
 * Same blocks for the period just before (decision of 2026-11-26), without the
 * series. Indicators that describe the present moment (`active`, `onLeave`,
 * `absencesToday`, `pending`, `openJobs`, `reviewsInProgress`,
 * `avgGoalProgress`, `punctualityRate`) are not kept in history: null here.
 */
export interface PreviousPeriod {
  period: { from: string; to: string }
  headcount: {
    total: number
    active: null
    onLeave: null
    newHires: number
    exits: number
  } | null
  attendance: {
    punctualityRate: null
    avgWorkedHours: number | null
    absencesToday: null
    outOfZonePunches: number
  } | null
  leaves: { pending: null; approvedThisPeriod: number; daysTaken: number } | null
  recruitment: { openJobs: null; newCandidates: number; hired: number } | null
  performance: { reviewsInProgress: null; reviewsSigned: number; avgGoalProgress: null } | null
  payroll: Payroll | null
}

/**
 * GET /org/dashboard (docs/backend/06 §3): aggregates of the caller's scope,
 * owner and hr_admin the whole organization, a manager their team and
 * themselves, anyone else their own record. Cached 5 minutes per scope.
 */
export class DashboardService {
  async show(tenant: TenantContext, period: DashboardPeriod = 'month'): Promise<Dashboard> {
    const { organizationId } = tenant
    const entitlements = await entitlementService.resolve(organizationId)
    return withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      const { scope, key } = await this.scope(tenant, trx)
      // Recruitment and payroll depend on the roles, not only on the scope.
      const seesRecruitment = tenant.hasRole('owner', 'hr_admin', 'recruiter')
      const seesPayroll = tenant.hasRole('owner', 'hr_admin')
      const flags = `${seesRecruitment ? ':rec' : ''}${seesPayroll ? ':pay' : ''}`
      const cacheKey = `dash:${CACHE_VERSION}:${organizationId}:${period}:${key}${flags}`
      const cached = await this.readCache(cacheKey)
      if (cached) return cached

      const timezone = organization.timezone
      const bounds = periodBounds(period, timezone)
      const previous = previousPeriodBounds(period, timezone)
      const today = DateTime.now().setZone(timezone).toISODate()!
      const currency = organization.defaultCurrency
      const months = lastTwelveMonths(timezone)
      const can = (module: ModuleKey) => allowed(entitlements, module)
      const repository = dashboardIn(organizationId, trx)
      const recruitmentOn = seesRecruitment && can('recruitment')
      const payrollOn = seesPayroll && can('hr')

      const dashboard: Dashboard = {
        period: { from: bounds.from, to: bounds.to },
        headcount: can('hr') ? await repository.headcount(scope, bounds) : null,
        attendance: can('timeclock')
          ? {
              // Needs work schedules to know when someone is late (lot 2 decision).
              punctualityRate: null,
              avgWorkedHours: await repository.avgWorkedHours(scope, bounds),
              absencesToday: await this.absencesToday(trx, organizationId, timezone, scope),
              outOfZonePunches: await repository.outOfZonePunches(scope, bounds),
            }
          : null,
        leaves: can('leaves') ? await repository.leaves(scope, bounds) : null,
        recruitment: recruitmentOn ? await repository.recruitment(bounds) : null,
        performance: can('performance') ? await repository.performance(scope, bounds) : null,
        payroll: payrollOn
          ? { total: await repository.payroll(today, currency, false), currency }
          : null,
        previous: {
          period: { from: previous.from, to: previous.to },
          headcount: can('hr') ? await this.previousHeadcount(repository, scope, previous) : null,
          attendance: can('timeclock')
            ? {
                punctualityRate: null,
                avgWorkedHours: await repository.avgWorkedHours(scope, previous),
                absencesToday: null,
                outOfZonePunches: await repository.outOfZonePunches(scope, previous),
              }
            : null,
          leaves: can('leaves') ? await this.previousLeaves(repository, scope, previous) : null,
          recruitment: recruitmentOn
            ? { ...(await repository.recruitment(previous)), openJobs: null }
            : null,
          performance: can('performance')
            ? await this.previousPerformance(repository, scope, previous)
            : null,
          payroll: payrollOn
            ? { total: await repository.payroll(previous.to, currency, true), currency }
            : null,
        },
        series: {
          headcountByMonth: can('hr')
            ? await repository.headcountByMonth(scope, months.first, months.last)
            : null,
          punchesByDay: can('timeclock')
            ? await repository.punchesByDay(scope, bounds, timezone)
            : null,
          leavesByType: can('leaves') ? await repository.leavesByType(scope, bounds) : null,
        },
      }
      await this.writeCache(cacheKey, dashboard)
      return dashboard
    })
  }

  private async previousHeadcount(
    repository: ReturnType<typeof dashboardIn>,
    scope: Scope,
    period: Parameters<ReturnType<typeof dashboardIn>['leaves']>[1]
  ) {
    const { newHires, exits } = await repository.headcount(scope, period)
    const total = await repository.headcountAt(scope, period.to)
    return { total, active: null, onLeave: null, newHires, exits }
  }

  private async previousPerformance(
    repository: ReturnType<typeof dashboardIn>,
    scope: Scope,
    period: Parameters<ReturnType<typeof dashboardIn>['leaves']>[1]
  ) {
    const { reviewsSigned } = await repository.performance(scope, period)
    return { reviewsInProgress: null, reviewsSigned, avgGoalProgress: null }
  }

  private async previousLeaves(
    repository: ReturnType<typeof dashboardIn>,
    scope: Scope,
    period: Parameters<ReturnType<typeof dashboardIn>['leaves']>[1]
  ) {
    const { approvedThisPeriod, daysTaken } = await repository.leaves(scope, period)
    return { pending: null, approvedThisPeriod, daysTaken }
  }

  /** Absent staff of today's board (`GET /org/timeclock/today`), within the scope. */
  private async absencesToday(
    trx: Parameters<Parameters<typeof withTenant>[1]>[0],
    organizationId: string,
    timezone: string,
    scope: Scope
  ) {
    const board = await attendanceService.board(trx, organizationId, timezone, scope)
    return board.absent.length
  }

  /** The caller's scope and its cache key: `org`, `team:<id>` or `self:<id>`. */
  private async scope(
    tenant: TenantContext,
    trx: Parameters<Parameters<typeof withTenant>[1]>[0]
  ): Promise<{ scope: Scope; key: string }> {
    if (tenant.hasRole('owner', 'hr_admin')) return { scope: undefined, key: 'org' }
    const self = tenant.employeeId
    if (!self) return { scope: [], key: 'none' }
    if (tenant.hasRole('manager')) {
      const team = await employeesIn(tenant.organizationId, trx).teamIds(self)
      return { scope: [...team, self], key: `team:${self}` }
    }
    return { scope: [self], key: `self:${self}` }
  }

  /** A cache outage never fails the dashboard: it is computed instead. */
  private async readCache(key: string): Promise<Dashboard | null> {
    try {
      const raw = await redis.connection('cache').get(key)
      return raw ? (JSON.parse(raw) as Dashboard) : null
    } catch (error) {
      logger.warn({ err: error }, 'dashboard.cache_unavailable')
      return null
    }
  }

  private async writeCache(key: string, dashboard: Dashboard) {
    try {
      await redis.connection('cache').set(key, JSON.stringify(dashboard), 'EX', CACHE_TTL_SECONDS)
    } catch (error) {
      logger.warn({ err: error }, 'dashboard.cache_unavailable')
    }
  }
}

/** A block shows only when its module is readable under the plan. */
function allowed(entitlements: Entitlements | null, module: ModuleKey) {
  return accessError(entitlements, module, true) === null
}

export default new DashboardService()
