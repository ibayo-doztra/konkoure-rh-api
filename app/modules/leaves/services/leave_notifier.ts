import logger from '@adonisjs/core/services/logger'
import type LeaveRequest from '#models/leave_request'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import { withTenant } from '#shared/tenant/with_tenant'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import {
  LeaveDecidedMail,
  LeaveRequestedMail,
  type LeaveMailDetails,
} from '#modules/leaves/mails/leave_mails'

/**
 * Leave e-mails (docs/backend/08 §4), sent after the commit. Nobody is told
 * of their own action (07 §8); a failure is logged, never raised.
 */
export class LeaveNotifier {
  /**
   * `leave_requested`, to the approver of 07 §3.7: the direct manager, else
   * every hr_admin, else every owner.
   */
  async requested(leave: LeaveRequest, actorUserId: string, balanceAfter: number | null) {
    await this.safely('leave_requested', leave, async () => {
      const { recipients, details } = await withTenant(leave.organizationId, async (trx) => {
        const members = membersIn(leave.organizationId, trx)
        const employee = await employeesIn(leave.organizationId, trx).find(leave.employeeId)
        const requester = await members.accountOfEmployee(leave.employeeId)
        const excluded = new Set([actorUserId, requester?.id])
        const keep = (accounts: Array<MailAccount | null>) =>
          accounts.filter(
            (account): account is MailAccount => account !== null && !excluded.has(account.id)
          )

        let found = keep([
          employee?.managerId ? await members.accountOfEmployee(employee.managerId) : null,
        ])
        if (found.length === 0) found = keep(await members.accountsWithRole('hr_admin'))
        if (found.length === 0) found = keep(await members.accountsWithRole('owner'))
        return { recipients: found, details: this.details(leave, employee) }
      })
      for (const recipient of recipients) {
        await dispatchMail(new LeaveRequestedMail(recipient, { ...details, balanceAfter }))
      }
    })
  }

  /** `leave_decided`, to the employee who took the leave. */
  async decided(leave: LeaveRequest, actorUserId: string) {
    if (leave.status !== 'approved' && leave.status !== 'rejected') return
    const decision = leave.status
    await this.safely('leave_decided', leave, async () => {
      const { recipient, details } = await withTenant(leave.organizationId, async (trx) => {
        const employee = await employeesIn(leave.organizationId, trx).find(leave.employeeId)
        const account = await membersIn(leave.organizationId, trx).accountOfEmployee(
          leave.employeeId
        )
        return { recipient: account, details: this.details(leave, employee) }
      })
      if (!recipient || recipient.id === actorUserId) return
      await dispatchMail(
        new LeaveDecidedMail(recipient, { ...details, decision, comment: leave.decisionComment })
      )
    })
  }

  private details(
    leave: LeaveRequest,
    employee: { firstName: string; lastName: string } | null
  ): LeaveMailDetails {
    return {
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : '',
      type: leave.type,
      startDate: leave.startDate.toISODate()!,
      endDate: leave.endDate.toISODate()!,
      requestedDays: Number(leave.requestedDays),
    }
  }

  private async safely(kind: string, leave: LeaveRequest, send: () => Promise<void>) {
    try {
      await send()
    } catch (error) {
      logger.error({ err: error, mail: kind, leaveId: leave.id }, 'leave.notify_failed')
    }
  }
}

export default new LeaveNotifier()
