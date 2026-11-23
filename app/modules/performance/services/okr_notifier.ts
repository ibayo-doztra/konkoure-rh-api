import logger from '@adonisjs/core/services/logger'
import type Okr from '#models/okr'
import notificationService from '#modules/notifications/services/notification_service'
import { withTenant } from '#shared/tenant/with_tenant'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'

/**
 * OKR notifications (docs/backend/07 §8, 08 §3), sent after the commit.
 * Nobody is told of their own action; a failure is logged, never raised.
 */
export class OkrNotifier {
  /** `okr.submitted`, to the direct manager, else every hr_admin, else every owner. */
  async submitted(okr: Okr, actorUserId: string) {
    await this.safely('okr.submitted', okr, async () => {
      const { recipients, employeeName } = await withTenant(okr.organizationId, async (trx) => {
        const members = membersIn(okr.organizationId, trx)
        const employee = okr.employeeId
          ? await employeesIn(okr.organizationId, trx).find(okr.employeeId)
          : null
        const keep = (accounts: Array<MailAccount | null>) =>
          accounts.filter(
            (account): account is MailAccount => account !== null && account.id !== actorUserId
          )
        let found = keep([
          employee?.managerId ? await members.accountOfEmployee(employee.managerId) : null,
        ])
        if (found.length === 0) found = keep(await members.accountsWithRole('hr_admin'))
        if (found.length === 0) found = keep(await members.accountsWithRole('owner'))
        return { recipients: found, employeeName: this.name(employee) }
      })
      await notificationService.notify(
        okr.organizationId,
        recipients,
        {
          type: 'okr.submitted',
          key: 'okrSubmitted',
          data: { employeeName, objective: okr.objective, quarter: okr.quarter },
          link: `/performance/okrs/${okr.id}`,
          payload: { okrId: okr.id, employeeId: okr.employeeId },
        },
        actorUserId
      )
    })
  }

  /** `okr.validated` or `okr.needs_revision`, to the holder. */
  async decided(okr: Okr, actorUserId: string) {
    const validated = okr.reviewStatus === 'validated'
    const type = validated ? 'okr.validated' : 'okr.needs_revision'
    await this.safely(type, okr, async () => {
      const recipient = await this.holder(okr)
      if (!recipient) return
      await notificationService.notify(
        okr.organizationId,
        [recipient],
        {
          type,
          key: validated ? 'okrValidated' : 'okrNeedsRevision',
          data: { objective: okr.objective, quarter: okr.quarter },
          link: `/performance/okrs/${okr.id}`,
          payload: { okrId: okr.id },
        },
        actorUserId
      )
    })
  }

  /** `okr.checkin_reminder` (07 §5.5), from the monthly job. */
  async checkinReminder(okr: Okr) {
    await this.safely('okr.checkin_reminder', okr, async () => {
      const recipient = await this.holder(okr)
      if (!recipient) return
      await notificationService.notify(
        okr.organizationId,
        [recipient],
        {
          type: 'okr.checkin_reminder',
          key: 'okrCheckinReminder',
          data: { objective: okr.objective, quarter: okr.quarter },
          link: `/performance/okrs/${okr.id}`,
          payload: { okrId: okr.id },
        },
        null
      )
    })
  }

  private holder(okr: Okr) {
    const employeeId = okr.employeeId
    if (!employeeId) return Promise.resolve(null)
    return withTenant(okr.organizationId, (trx) =>
      membersIn(okr.organizationId, trx).accountOfEmployee(employeeId)
    )
  }

  private name(employee: { firstName: string; lastName: string } | null) {
    return employee ? `${employee.firstName} ${employee.lastName}` : ''
  }

  private async safely(kind: string, okr: Okr, send: () => Promise<void>) {
    try {
      await send()
    } catch (error) {
      logger.error({ err: error, notification: kind, okrId: okr.id }, 'okr.notify_failed')
    }
  }
}

export default new OkrNotifier()
