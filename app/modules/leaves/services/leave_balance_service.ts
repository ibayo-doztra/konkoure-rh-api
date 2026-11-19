import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type LeaveBalance from '#models/leave_balance'
import type { LeaveType } from '#models/leave_request'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { leaveBalancesIn } from '#modules/leaves/repositories/leave_balance_repository'
import { leaveRequestsIn } from '#modules/leaves/repositories/leave_request_repository'
import { initialEntitlement, leaveSettings, type LeaveSettings } from '#modules/leaves/leave_rules'

/** What the leave service needs to know about the organization in a mutation. */
export interface LeaveScope {
  trx: TransactionClientContract
  organizationId: string
  settings: LeaveSettings
  /** Current year in the organization timezone. */
  currentYear: number
  /** Today (ISO) in the organization timezone. */
  today: string
}

/** Changes of the counters; positive values add days. */
export interface BalanceChange {
  entitledDays?: number
  takenDays?: number
  pendingDays?: number
}

export interface LedgerReason {
  reason: string
  actorUserId: string | null
  leaveRequestId?: string | null
}

export const displayedBalance = (balance: LeaveBalance) =>
  Number(balance.entitledDays) +
  Number(balance.carriedOverDays) -
  Number(balance.takenDays) -
  Number(balance.pendingDays)

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Balances (docs/backend/07 §3.3–3.6). A counter never moves without a
 * ledger row, in the same transaction: the sum of the ledger of an employee,
 * year and type always equals its displayed balance.
 */
export class LeaveBalanceService {
  /** Opens the tenant scope of a leave mutation. */
  async scope(trx: TransactionClientContract, organizationId: string): Promise<LeaveScope> {
    const organization = await organizations.findActive(organizationId, trx)
    if (!organization) throw new AppException('E_NOT_FOUND')
    const now = DateTime.now().setZone(organization.timezone)
    return {
      trx,
      organizationId,
      settings: leaveSettings(organization.settings),
      currentYear: now.year,
      today: now.toISODate()!,
    }
  }

  /**
   * The locked balance row, opened on first use with the entitlement of the
   * year (07 §3.3) and its ledger row. Callers hold the employee leave lock.
   */
  async open(
    scope: LeaveScope,
    employeeId: string,
    year: number,
    leaveType: LeaveType,
    actorUserId: string | null
  ): Promise<LeaveBalance> {
    const balances = leaveBalancesIn(scope.organizationId, scope.trx)
    const existing = await balances.forUpdate(employeeId, year, leaveType)
    if (existing) return existing

    const entitled = initialEntitlement(leaveType, scope.settings)
    const balance = await balances.create({
      employeeId,
      year,
      leaveType,
      entitledDays: entitled.toFixed(2),
      carriedOverDays: '0.00',
      takenDays: '0.00',
      pendingDays: '0.00',
    })
    if (entitled !== 0) {
      await balances.record({
        employeeId,
        year,
        leaveType,
        deltaDays: entitled.toFixed(2),
        reason: 'entitlement',
        actorUserId,
      })
    }
    await this.refreshCache(scope, balance)
    return balance
  }

  /** Applies `change` to the counters and journals its effect on the balance. */
  async move(
    scope: LeaveScope,
    balance: LeaveBalance,
    change: BalanceChange,
    entry: LedgerReason
  ): Promise<LeaveBalance> {
    const before = displayedBalance(balance)
    balance.merge({
      entitledDays: round(Number(balance.entitledDays) + (change.entitledDays ?? 0)).toFixed(2),
      takenDays: round(Number(balance.takenDays) + (change.takenDays ?? 0)).toFixed(2),
      pendingDays: round(Number(balance.pendingDays) + (change.pendingDays ?? 0)).toFixed(2),
    })
    const balances = leaveBalancesIn(scope.organizationId, scope.trx)
    await balances.save(balance)
    await balances.record({
      employeeId: balance.employeeId,
      year: balance.year,
      leaveType: balance.leaveType,
      leaveRequestId: entry.leaveRequestId ?? null,
      deltaDays: round(displayedBalance(balance) - before).toFixed(2),
      reason: entry.reason,
      actorUserId: entry.actorUserId,
    })
    await this.refreshCache(scope, balance)
    return balance
  }

  /** Balances visible to the viewer for a year (06 §7): all, team and self, or self. */
  list(tenant: TenantContext, query: { employeeId?: string; year?: number }) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const scope = await this.scope(trx, organizationId)
      const year = query.year ?? scope.currentYear
      let employeeIds: string[] | undefined
      if (!tenant.hasRole('owner', 'hr_admin')) {
        const self = tenant.employeeId
        const team =
          tenant.hasRole('manager') && self
            ? await employeesIn(organizationId, trx).teamIds(self)
            : []
        employeeIds = [...team, ...(self ? [self] : [])]
      }
      if (query.employeeId) {
        if (employeeIds && !employeeIds.includes(query.employeeId)) {
          throw new AppException('E_FORBIDDEN')
        }
        employeeIds = [query.employeeId]
      }
      return leaveBalancesIn(organizationId, trx).list(year, employeeIds)
    })
  }

  /** HR correction of the entitlement (06 §7), audited and journaled. */
  adjust(
    tenant: TenantContext,
    actor: User,
    input: {
      employeeId: string
      leaveType: LeaveType
      year?: number
      deltaDays: number
      reason: string
    },
    audit: AuditContext
  ): Promise<LeaveBalance> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      if (input.deltaDays === 0) {
        throw AppException.validation('deltaDays', 'notZero', 'validation.leave.deltaDays')
      }
      const scope = await this.scope(trx, organizationId)
      if (!(await employeesIn(organizationId, trx).find(input.employeeId))) {
        throw AppException.validation('employeeId', 'exists', 'validation.leave.employee')
      }
      await leaveRequestsIn(organizationId, trx).lockEmployee(input.employeeId)
      const year = input.year ?? scope.currentYear
      const balance = await this.open(scope, input.employeeId, year, input.leaveType, actor.id)
      const before = displayedBalance(balance)
      await this.move(
        scope,
        balance,
        { entitledDays: input.deltaDays },
        { reason: input.reason, actorUserId: actor.id }
      )
      await auditService.record(
        trx,
        { ...audit, organizationId, actorRole: tenant.primaryRole },
        {
          action: 'leave_balance.adjusted',
          targetType: 'employee',
          targetId: input.employeeId,
          before: { leaveType: input.leaveType, year, balance: before },
          after: {
            leaveType: input.leaveType,
            year,
            balance: displayedBalance(balance),
            deltaDays: input.deltaDays,
            reason: input.reason,
          },
        }
      )
      return balance
    })
  }

  /** `employees.leave_balance` mirrors the annual balance of the current year. */
  private async refreshCache(scope: LeaveScope, balance: LeaveBalance) {
    if (balance.leaveType !== 'annual' || balance.year !== scope.currentYear) return
    await employeesIn(scope.organizationId, scope.trx).setLeaveBalance(
      balance.employeeId,
      displayedBalance(balance)
    )
  }
}

export default new LeaveBalanceService()
