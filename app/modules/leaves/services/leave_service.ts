import { DateTime } from 'luxon'
import type User from '#models/user'
import type LeaveBalance from '#models/leave_balance'
import type LeaveRequest from '#models/leave_request'
import type { LeaveStatus, LeaveType } from '#models/leave_request'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { holidaysIn } from '#modules/leaves/repositories/holiday_repository'
import { leaveBalancesIn } from '#modules/leaves/repositories/leave_balance_repository'
import { leaveRequestsIn } from '#modules/leaves/repositories/leave_request_repository'
import { consumesBalance, countLeaveDays } from '#modules/leaves/leave_rules'
import leaveBalanceService, {
  displayedBalance,
  type LeaveScope,
} from '#modules/leaves/services/leave_balance_service'

export interface LeaveInput {
  type: LeaveType
  startDate: DateTime
  endDate: DateTime
  halfDayStart?: boolean
  halfDayEnd?: boolean
  reason?: string | null
}

export interface LeaveListQuery {
  page?: number
  perPage?: number
  filter?: {
    employeeId?: string
    status?: LeaveStatus
    type?: LeaveType
    from?: DateTime
    to?: DateTime
  }
}

/** A leave with what its readers need: next approver (07 §3.7), projected balance (§3.4). */
export interface LeaveView {
  leave: LeaveRequest
  approverId: string | null
  balanceAfter: number | null
}

const day = (value: DateTime) => value.toISODate()!

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'status', rule, message }] })

const isOverlapViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23P01'

/** Leave requests (docs/backend/06 §7, 07 §3). */
export class LeaveService {
  /** Leaves visible to the viewer: all (O/H), team and self (M), self otherwise. */
  list(tenant: TenantContext, query: LeaveListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      let employeeIds: string[] | undefined
      if (!tenant.hasRole('owner', 'hr_admin')) {
        const self = tenant.employeeId
        const team =
          tenant.hasRole('manager') && self
            ? await employeesIn(organizationId, trx).teamIds(self)
            : []
        employeeIds = [...team, ...(self ? [self] : [])]
      }
      const page = await leaveRequestsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        employeeId: query.filter?.employeeId,
        status: query.filter?.status,
        type: query.filter?.type,
        from: query.filter?.from ? day(query.filter.from) : undefined,
        to: query.filter?.to ? day(query.filter.to) : undefined,
        employeeIds,
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  /** A leave and whether it belongs to the viewer's team, for the policy. */
  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const leave = await leaveRequestsIn(organizationId, trx).findOrFail(id)
      const self = tenant.employeeId
      const inTeam =
        self !== null && tenant.hasRole('manager')
          ? await employeesIn(organizationId, trx).isInTeamOf(self, leave.employeeId)
          : false
      return { leave, inTeam }
    })
  }

  view(tenant: TenantContext, leave: LeaveRequest): Promise<LeaveView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const employee = await employeesIn(organizationId, trx).find(leave.employeeId)
      let balanceAfter: number | null = null
      if (consumesBalance(leave.type)) {
        const balance = await leaveBalancesIn(organizationId, trx).of(
          leave.employeeId,
          leave.startDate.year,
          leave.type
        )
        balanceAfter = balance ? displayedBalance(balance) : null
      }
      return { leave, approverId: employee?.managerId ?? null, balanceAfter }
    })
  }

  create(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    input: LeaveInput,
    audit: AuditContext
  ): Promise<LeaveView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const scope = await leaveBalanceService.scope(trx, organizationId)
      const employee = await employeesIn(organizationId, trx).find(employeeId)
      if (!employee) {
        throw AppException.validation('employeeId', 'exists', 'validation.leave.employee')
      }
      if (employee.status === 'terminated') {
        throw AppException.validation(
          'employeeId',
          'terminated',
          'validation.leave.employeeTerminated'
        )
      }
      const leaves = leaveRequestsIn(organizationId, trx)
      await leaves.lockEmployee(employeeId)

      const fields = await this.prepare(scope, employeeId, input)
      const balance = await this.reserve(scope, employeeId, fields, actor)
      const leave = await this.guardOverlap(() =>
        leaves.create({ ...fields, employeeId, createdBy: actor.id })
      )
      await leaveBalanceService.move(
        scope,
        balance,
        { pendingDays: Number(fields.requestedDays) },
        { reason: 'leave_requested', actorUserId: actor.id, leaveRequestId: leave.id }
      )
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'leave.requested',
        targetType: 'leave_request',
        targetId: leave.id,
        after: { employeeId, type: leave.type, requestedDays: Number(fields.requestedDays) },
      })
      await leave.refresh()
      return this.result(leave, employee.managerId, balance)
    })
  }

  /** PATCH by the author while pending: dates, type and days are recomputed. */
  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: Partial<LeaveInput>,
    audit: AuditContext
  ): Promise<LeaveView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const scope = await leaveBalanceService.scope(trx, organizationId)
      const leaves = leaveRequestsIn(organizationId, trx)
      const leave = await this.lock(scope, id)
      if (leave.status !== 'pending') throw conflict('notPending', 'validation.leave.notPending')
      const employee = await employeesIn(organizationId, trx).find(leave.employeeId)

      const next: LeaveInput = {
        type: input.type ?? leave.type,
        startDate: input.startDate ?? leave.startDate,
        endDate: input.endDate ?? leave.endDate,
        halfDayStart: input.halfDayStart ?? leave.halfDayStart,
        halfDayEnd: input.halfDayEnd ?? leave.halfDayEnd,
      }
      const fields = await this.prepare(scope, leave.employeeId, next, leave.id)

      // The days held by the current version go back before the new ones are reserved.
      const held = await leaveBalanceService.open(
        scope,
        leave.employeeId,
        leave.startDate.year,
        leave.type,
        actor.id
      )
      await leaveBalanceService.move(
        scope,
        held,
        { pendingDays: -Number(leave.requestedDays) },
        { reason: 'leave_updated', actorUserId: actor.id, leaveRequestId: leave.id }
      )
      const balance = await this.reserve(scope, leave.employeeId, fields, actor)
      await leaveBalanceService.move(
        scope,
        balance,
        { pendingDays: Number(fields.requestedDays) },
        { reason: 'leave_updated', actorUserId: actor.id, leaveRequestId: leave.id }
      )

      const before = { type: leave.type, requestedDays: Number(leave.requestedDays) }
      leave.merge({ ...fields, ...(input.reason !== undefined ? { reason: input.reason } : {}) })
      await this.guardOverlap(() => leaves.save(leave))
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'leave.updated',
        targetType: 'leave_request',
        targetId: leave.id,
        before,
        after: { type: leave.type, requestedDays: Number(leave.requestedDays) },
      })
      await leave.refresh()
      return this.result(leave, employee?.managerId ?? null, balance)
    })
  }

  /** pending → approved: the days move from pending to taken (07 §3.6). */
  approve(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    return this.decide(tenant, actor, id, 'approved', null, audit)
  }

  /** pending → rejected, with the mandatory comment (07 §3.5). */
  reject(tenant: TenantContext, actor: User, id: string, comment: string, audit: AuditContext) {
    return this.decide(tenant, actor, id, 'rejected', comment, audit)
  }

  /**
   * pending → cancelled, or approved → cancelled before its first day: an
   * approved leave that has started is locked (07 §3.5).
   */
  cancel(tenant: TenantContext, actor: User, id: string, audit: AuditContext): Promise<LeaveView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const scope = await leaveBalanceService.scope(trx, organizationId)
      const leave = await this.lock(scope, id)
      if (leave.status === 'approved' && day(leave.startDate) <= scope.today) {
        throw conflict('locked', 'validation.leave.locked')
      }
      if (leave.status !== 'pending' && leave.status !== 'approved') {
        throw conflict('notCancellable', 'validation.leave.notCancellable')
      }

      const days = Number(leave.requestedDays)
      const balance = await leaveBalanceService.open(
        scope,
        leave.employeeId,
        leave.startDate.year,
        leave.type,
        actor.id
      )
      const before = { status: leave.status }
      await leaveBalanceService.move(
        scope,
        balance,
        leave.status === 'approved' ? { takenDays: -days } : { pendingDays: -days },
        { reason: 'leave_cancelled', actorUserId: actor.id, leaveRequestId: leave.id }
      )
      leave.merge({ status: 'cancelled', balanceApplied: false })
      await leaveRequestsIn(organizationId, trx).save(leave)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'leave.cancelled',
        targetType: 'leave_request',
        targetId: leave.id,
        before,
        after: { status: 'cancelled' },
      })
      const employee = await employeesIn(organizationId, trx).find(leave.employeeId)
      return this.result(leave, employee?.managerId ?? null, balance)
    })
  }

  private decide(
    tenant: TenantContext,
    actor: User,
    id: string,
    status: 'approved' | 'rejected',
    comment: string | null,
    audit: AuditContext
  ): Promise<LeaveView> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const scope = await leaveBalanceService.scope(trx, organizationId)
      const leave = await this.lock(scope, id)
      if (leave.status !== 'pending') throw conflict('notPending', 'validation.leave.notPending')

      const days = Number(leave.requestedDays)
      const balance = await leaveBalanceService.open(
        scope,
        leave.employeeId,
        leave.startDate.year,
        leave.type,
        actor.id
      )
      await leaveBalanceService.move(
        scope,
        balance,
        status === 'approved' ? { pendingDays: -days, takenDays: days } : { pendingDays: -days },
        { reason: `leave_${status}`, actorUserId: actor.id, leaveRequestId: leave.id }
      )
      leave.merge({
        status,
        decisionComment: comment,
        decidedBy: actor.id,
        decidedAt: DateTime.now(),
        balanceApplied: status === 'approved',
      })
      await leaveRequestsIn(organizationId, trx).save(leave)
      await auditService.record(trx, this.context(tenant, audit), {
        action: `leave.${status}`,
        targetType: 'leave_request',
        targetId: leave.id,
        before: { status: 'pending' },
        after: { status, requestedDays: days },
      })
      const employee = await employeesIn(organizationId, trx).find(leave.employeeId)
      return this.result(leave, employee?.managerId ?? null, balance)
    })
  }

  /** Locks the employee's leaves, then the request itself. */
  private async lock(scope: LeaveScope, id: string) {
    const leaves = leaveRequestsIn(scope.organizationId, scope.trx)
    const found = await leaves.findOrFail(id)
    await leaves.lockEmployee(found.employeeId)
    const leave = await leaves.findForUpdate(id)
    if (!leave) throw new AppException('E_NOT_FOUND')
    return leave
  }

  /** Validated columns of a version of the request (07 §3.1, §3.2). */
  private async prepare(scope: LeaveScope, employeeId: string, input: LeaveInput, id?: string) {
    const startDate = day(input.startDate)
    const endDate = day(input.endDate)
    if (endDate < startDate) {
      throw AppException.validation('endDate', 'afterOrEqual', 'validation.leave.endDate')
    }
    const year = input.startDate.year
    if (input.endDate.year !== year) {
      throw AppException.validation('endDate', 'sameYear', 'validation.leave.sameYear')
    }
    const holidays = scope.settings.countHolidays
      ? new Set<string>()
      : await holidaysIn(scope.organizationId, scope.trx).datesWithin(startDate, endDate, year)
    const halfDayStart = input.halfDayStart ?? false
    const halfDayEnd = input.halfDayEnd ?? false
    const requested = countLeaveDays({
      startDate,
      endDate,
      halfDayStart,
      halfDayEnd,
      holidays,
      countWeekends: scope.settings.countWeekends,
      countHolidays: scope.settings.countHolidays,
    })
    if (requested <= 0) {
      throw AppException.validation('startDate', 'noWorkingDay', 'validation.leave.noWorkingDay')
    }
    const leaves = leaveRequestsIn(scope.organizationId, scope.trx)
    if (await leaves.overlaps(employeeId, startDate, endDate, id)) {
      throw new AppException('E_LEAVE_OVERLAP')
    }
    return {
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      halfDayStart,
      halfDayEnd,
      requestedDays: requested.toFixed(2),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    }
  }

  /** Opens the balance of the request and enforces the negative limit (07 §3.4). */
  private async reserve(
    scope: LeaveScope,
    employeeId: string,
    fields: { type: LeaveType; startDate: DateTime; requestedDays: string },
    actor: User
  ) {
    const balance = await leaveBalanceService.open(
      scope,
      employeeId,
      fields.startDate.year,
      fields.type,
      actor.id
    )
    if (consumesBalance(fields.type)) {
      const projected = displayedBalance(balance) - Number(fields.requestedDays)
      const { allowNegativeBalance, maxNegativeDays } = scope.settings
      if (projected < 0 && (!allowNegativeBalance || projected < -maxNegativeDays)) {
        throw new AppException('E_INSUFFICIENT_BALANCE')
      }
    }
    return balance
  }

  private async guardOverlap<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write()
    } catch (error) {
      if (isOverlapViolation(error)) throw new AppException('E_LEAVE_OVERLAP', { cause: error })
      throw error
    }
  }

  private result(leave: LeaveRequest, approverId: string | null, balance: LeaveBalance): LeaveView {
    return {
      leave,
      approverId,
      balanceAfter: consumesBalance(leave.type) ? displayedBalance(balance) : null,
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new LeaveService()
