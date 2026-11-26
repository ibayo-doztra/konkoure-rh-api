import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type WorkSchedule from '#models/work_schedule'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import {
  workSchedulesIn,
  type WorkScheduleRepository,
} from '#modules/timeclock/repositories/work_schedule_repository'
import { patternProblem, type WeeklyPattern } from '#modules/timeclock/schedule_rules'

export interface ScheduleInput {
  name?: string
  isDefault?: boolean
  weeklyPattern?: WeeklyPattern
  employeeId?: string | null
}

interface CheckedSchedule {
  name: string
  isDefault: boolean
  weeklyPattern: WeeklyPattern
  employeeId: string | null
}

const invalid = (field: string, rule: string) =>
  AppException.validation(field, rule, `validation.timeclock.${rule}`)

const conflict = (field: string, rule: string) =>
  new AppException('E_CONFLICT', {
    details: [{ field, rule, message: `validation.timeclock.${rule}` }],
  })

/**
 * Work schedules (docs/backend/02 §6, 06 §6, decision of 2026-11-26): the
 * organization's templates, one of them the default, and employees' own
 * schedules. An employee follows their own schedule, else the default. A
 * change applies to the days aggregated from then on.
 */
export class WorkScheduleService {
  list(tenant: TenantContext): Promise<WorkSchedule[]> {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => workSchedulesIn(organizationId, trx).all())
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: ScheduleInput & { name: string; weeklyPattern: WeeklyPattern },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const schedules = workSchedulesIn(organizationId, trx)
      const next: CheckedSchedule = {
        name: input.name,
        isDefault: input.isDefault ?? false,
        weeklyPattern: input.weeklyPattern,
        employeeId: input.employeeId ?? null,
      }
      await this.check(schedules, trx, next)
      if (next.isDefault) await schedules.clearDefault()
      const schedule = await schedules.create({ ...next, createdBy: actor.id })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'work_schedule.created',
        targetType: 'work_schedule',
        targetId: schedule.id,
        after: { name: next.name, isDefault: next.isDefault, employeeId: next.employeeId },
      })
      await schedule.refresh()
      return schedule
    })
  }

  update(tenant: TenantContext, id: string, input: ScheduleInput, audit: AuditContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const schedules = workSchedulesIn(organizationId, trx)
      const schedule = await schedules.findForUpdate(id)
      if (!schedule) throw new AppException('E_NOT_FOUND')
      const next: CheckedSchedule = {
        name: input.name ?? schedule.name,
        isDefault: input.isDefault ?? schedule.isDefault,
        weeklyPattern: input.weeklyPattern ?? schedule.weeklyPattern,
        employeeId: input.employeeId === undefined ? schedule.employeeId : input.employeeId,
      }
      await this.check(schedules, trx, next, id)
      const before = {
        name: schedule.name,
        isDefault: schedule.isDefault,
        employeeId: schedule.employeeId,
      }
      if (next.isDefault && !schedule.isDefault) await schedules.clearDefault(id)
      schedule.merge(next)
      await schedules.save(schedule)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'work_schedule.updated',
        targetType: 'work_schedule',
        targetId: id,
        before,
        after: { name: next.name, isDefault: next.isDefault, employeeId: next.employeeId },
      })
      await schedule.refresh()
      return schedule
    })
  }

  /** Hard delete; the default stays until another one is chosen (409). */
  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const schedules = workSchedulesIn(organizationId, trx)
      const schedule = await schedules.findForUpdate(id)
      if (!schedule) throw new AppException('E_NOT_FOUND')
      if (schedule.isDefault) throw conflict('id', 'scheduleDefault')
      await schedules.remove(schedule)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'work_schedule.deleted',
        targetType: 'work_schedule',
        targetId: id,
        before: { name: schedule.name, employeeId: schedule.employeeId },
      })
    })
  }

  private async check(
    schedules: WorkScheduleRepository,
    trx: TransactionClientContract,
    input: CheckedSchedule,
    exceptId?: string
  ) {
    const problem = patternProblem(input.weeklyPattern)
    if (problem) throw invalid('weeklyPattern', problem)
    if (input.isDefault && input.employeeId) {
      throw invalid('isDefault', 'scheduleDefaultEmployee')
    }
    if (input.employeeId) {
      const employee = await employeesIn(schedules.organizationId, trx).find(input.employeeId)
      if (!employee) throw invalid('employeeId', 'employee')
      if (await schedules.employeeTaken(input.employeeId, exceptId)) {
        throw conflict('employeeId', 'scheduleEmployee')
      }
    }
    if (await schedules.nameTaken(input.name, exceptId)) throw conflict('name', 'scheduleName')
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new WorkScheduleService()
