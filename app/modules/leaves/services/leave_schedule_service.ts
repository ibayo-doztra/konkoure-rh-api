import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { withTenant } from '#shared/tenant/with_tenant'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { leaveBalancesIn } from '#modules/leaves/repositories/leave_balance_repository'
import { leaveRequestsIn } from '#modules/leaves/repositories/leave_request_repository'
import leaveBalanceService, {
  displayedBalance,
  type LeaveScope,
} from '#modules/leaves/services/leave_balance_service'

/** How far back `leaves:end` looks for a finished leave (a missed night is caught up). */
const END_LOOKBACK_DAYS = 7

export type LeaveTask = 'apply-started' | 'end' | 'annual-rollover'

/**
 * Scheduled leave tasks (docs/backend/08 §2, 07 §3.8). Each one visits every
 * organization in its own transaction, in the organization timezone, and only
 * acts on rows not yet in the target state: running it twice changes nothing.
 * An organization that fails does not stop the others; the task then fails so
 * that the queue retries it.
 */
export class LeaveScheduleService {
  run(task: LeaveTask, at: DateTime = DateTime.now()) {
    switch (task) {
      case 'apply-started':
        return this.eachOrganization(task, at, (scope) => this.applyStarted(scope))
      case 'end':
        return this.eachOrganization(task, at, (scope) => this.end(scope))
      case 'annual-rollover':
        return this.eachOrganization(task, at, (scope) => this.annualRollover(scope))
    }
  }

  /** Active employees with an approved leave covering today ⇒ `on_leave`. */
  private async applyStarted(scope: LeaveScope) {
    const ids = await leaveRequestsIn(scope.organizationId, scope.trx).startedEmployeeIds(
      scope.today
    )
    return employeesIn(scope.organizationId, scope.trx).switchStatus(ids, 'active', 'on_leave')
  }

  /** `on_leave` employees whose approved leave has ended ⇒ `active`. */
  private async end(scope: LeaveScope) {
    const since = DateTime.fromISO(scope.today).minus({ days: END_LOOKBACK_DAYS }).toISODate()!
    const ids = await leaveRequestsIn(scope.organizationId, scope.trx).endedEmployeeIds(
      since,
      scope.today
    )
    return employeesIn(scope.organizationId, scope.trx).switchStatus(ids, 'on_leave', 'active')
  }

  /**
   * Carry-over of the annual balance (07 §3.8): min(remaining balance of the
   * previous year, `maxCarryOverDays`), never below 0, journaled `carry_over`.
   */
  private async annualRollover(scope: LeaveScope) {
    const year = scope.currentYear
    const balances = leaveBalancesIn(scope.organizationId, scope.trx)
    const leaves = leaveRequestsIn(scope.organizationId, scope.trx)
    let done = 0
    for (const previous of await balances.annualOf(year - 1)) {
      await leaves.lockEmployee(previous.employeeId)
      if (await balances.hasEntry(previous.employeeId, year, 'annual', 'carry_over')) continue
      const carry = Math.max(
        0,
        Math.min(displayedBalance(previous), scope.settings.maxCarryOverDays)
      )
      const balance = await leaveBalanceService.open(
        scope,
        previous.employeeId,
        year,
        'annual',
        null
      )
      await leaveBalanceService.move(
        scope,
        balance,
        { carriedOverDays: carry },
        { reason: 'carry_over', actorUserId: null }
      )
      done += 1
    }
    return done
  }

  private async eachOrganization(
    task: LeaveTask,
    at: DateTime,
    work: (scope: LeaveScope) => Promise<number>
  ) {
    let changed = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        changed += await withTenant(organizationId, async (trx: TransactionClientContract) =>
          work(await leaveBalanceService.scope(trx, organizationId, at))
        )
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, task, organizationId }, 'leaves.task_failed')
      }
    }
    logger.info({ task, changed, failed: failed.length }, 'leaves.task_done')
    if (failed.length > 0) {
      throw new Error(`leaves:${task} failed for ${failed.length} organization(s)`)
    }
    return changed
  }
}

export default new LeaveScheduleService()
