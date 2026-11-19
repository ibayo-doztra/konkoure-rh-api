import { type DateTime } from 'luxon'
import type TimeLog from '#models/time_log'
import type { PunchAnomaly, PunchSource, PunchType } from '#models/time_log'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { timeLogsIn } from '#modules/timeclock/repositories/time_log_repository'
import { workZonesIn } from '#modules/timeclock/repositories/work_zone_repository'

export interface TimeLogQuery {
  page?: number
  perPage?: number
  filter?: {
    employeeId?: string
    from?: DateTime
    to?: DateTime
    source?: PunchSource
    anomaly?: PunchAnomaly
  }
}

export interface TimeLogCorrection {
  type?: PunchType
  punchedAt?: DateTime
  workZoneId?: string | null
  notes?: string | null
}

/** Punch history and HR corrections (docs/backend/06 §6, 07 §2.9). */
export class TimeLogService {
  /** O/H and security agents read every punch, managers their team and themselves (04 §5). */
  list(tenant: TenantContext, query: TimeLogQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      let employeeIds: string[] | undefined
      if (!tenant.hasRole('owner', 'hr_admin', 'security_agent')) {
        const self = tenant.employeeId
        const team =
          tenant.hasRole('manager') && self
            ? await employeesIn(organizationId, trx).teamIds(self)
            : []
        employeeIds = [...team, ...(self ? [self] : [])]
      }
      const page = await timeLogsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 50,
        employeeId: query.filter?.employeeId,
        from: query.filter?.from?.toISO() ?? undefined,
        to: query.filter?.to?.toISO() ?? undefined,
        source: query.filter?.source,
        anomaly: query.filter?.anomaly,
        employeeIds,
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  /** Correction by owner or hr_admin; the previous values go to the audit log. */
  correct(tenant: TenantContext, id: string, input: TimeLogCorrection, audit: AuditContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const logs = timeLogsIn(organizationId, trx)
      const log = await logs.findForUpdate(id)
      if (!log) throw new AppException('E_NOT_FOUND')
      if (Object.values(input).every((value) => value === undefined)) {
        throw AppException.validation('body', 'required', 'validation.timeclock.logChange')
      }
      if (input.workZoneId && !(await workZonesIn(organizationId, trx).find(input.workZoneId))) {
        throw AppException.validation('workZoneId', 'exists', 'validation.timeclock.zone')
      }
      const before = this.snapshot(log)
      // A new `punched_at` moves the row to its month partition (PostgreSQL ≥ 11).
      log.merge(this.changes(input))
      await logs.save(log)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'time_log.corrected',
        targetType: 'time_log',
        targetId: id,
        before,
        after: this.snapshot(log),
      })
      return log
    })
  }

  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const logs = timeLogsIn(organizationId, trx)
      const log = await logs.findForUpdate(id)
      if (!log) throw new AppException('E_NOT_FOUND')
      await logs.forgetClientId(log)
      await logs.remove(log)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'time_log.deleted',
        targetType: 'time_log',
        targetId: id,
        before: this.snapshot(log),
      })
    })
  }

  private changes(input: TimeLogCorrection) {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<TimeLog>
  }

  private snapshot(log: TimeLog) {
    return {
      employeeId: log.employeeId,
      type: log.type,
      punchedAt: log.punchedAt.toISO(),
      workZoneId: log.workZoneId,
      source: log.source,
      notes: log.notes,
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new TimeLogService()
