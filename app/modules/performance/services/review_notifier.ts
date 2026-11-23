import logger from '@adonisjs/core/services/logger'
import type PerformanceReview from '#models/performance_review'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import notificationService, {
  type NotificationType,
} from '#modules/notifications/services/notification_service'
import { withTenant } from '#shared/tenant/with_tenant'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import { cyclesIn } from '#modules/performance/repositories/cycle_repository'
import {
  ReviewOpenedMail,
  ReviewSentBackMail,
  ReviewSignedMail,
} from '#modules/performance/mails/review_mails'

interface Context {
  employee: MailAccount | null
  manager: MailAccount | null
  hr: MailAccount[]
  employeeName: string
  cycleName: string
  deadline: string | null
}

/**
 * Evaluation notifications and e-mails (docs/backend/07 §5.8, §8, 08 §4),
 * sent after the commit. Nobody is told of their own action; a failure is
 * logged, never raised.
 */
export class ReviewNotifier {
  /** `review.opened` + `review_opened`, to each evaluated employee. */
  async opened(reviews: PerformanceReview[], actorUserId: string) {
    for (const review of reviews) {
      await this.safely('review.opened', review, async () => {
        const context = await this.context(review, false)
        if (!context.employee || context.employee.id === actorUserId) return
        await dispatchMail(
          new ReviewOpenedMail(context.employee, {
            cycleName: context.cycleName,
            deadline: context.deadline,
          })
        )
        await this.notify(
          review,
          'review.opened',
          'reviewOpened',
          [context.employee],
          context,
          actorUserId
        )
      })
    }
  }

  /** `review.submitted`, to the manager, else HR. */
  async submitted(review: PerformanceReview, actorUserId: string) {
    await this.safely('review.submitted', review, async () => {
      const context = await this.context(review, true)
      const recipients = context.manager ? [context.manager] : context.hr
      await this.notify(
        review,
        'review.submitted',
        'reviewSubmitted',
        recipients,
        context,
        actorUserId
      )
    })
  }

  /** `review.sent_back` + `review_sent_back`, to the employee. */
  async sentBack(review: PerformanceReview, actorUserId: string) {
    await this.safely('review.sent_back', review, async () => {
      const context = await this.context(review, false)
      if (!context.employee || context.employee.id === actorUserId) return
      await dispatchMail(
        new ReviewSentBackMail(context.employee, {
          cycleName: context.cycleName,
          comment: review.sentBackComment ?? '',
        })
      )
      await this.notify(
        review,
        'review.sent_back',
        'reviewSentBack',
        [context.employee],
        context,
        actorUserId
      )
    })
  }

  /** `review.validated`, to the employee, who now signs. */
  async validated(review: PerformanceReview, actorUserId: string) {
    await this.safely('review.validated', review, async () => {
      const context = await this.context(review, false)
      if (!context.employee) return
      await this.notify(
        review,
        'review.validated',
        'reviewValidated',
        [context.employee],
        context,
        actorUserId
      )
    })
  }

  /** `review.signed` + `review_signed`, to the manager and HR. */
  async signed(review: PerformanceReview, actorUserId: string) {
    await this.safely('review.signed', review, async () => {
      const context = await this.context(review, true)
      const recipients = new Map(
        [...(context.manager ? [context.manager] : []), ...context.hr].map((a) => [a.id, a])
      )
      recipients.delete(actorUserId)
      for (const recipient of recipients.values()) {
        await dispatchMail(
          new ReviewSignedMail(recipient, {
            employeeName: context.employeeName,
            signedAt: (review.signedAt ?? review.updatedAt).toUTC().toISO()!,
          })
        )
      }
      await this.notify(
        review,
        'review.signed',
        'reviewSigned',
        [...recipients.values()],
        context,
        actorUserId
      )
    })
  }

  /** `review.reminder` (decision of 2026-11-23), from the weekly job. */
  async reminder(review: PerformanceReview, to: 'employee' | 'manager') {
    await this.safely('review.reminder', review, async () => {
      const context = await this.context(review, false)
      const recipient = to === 'employee' ? context.employee : context.manager
      if (!recipient) return
      const key = to === 'employee' ? 'reviewReminderSelf' : 'reviewReminderManager'
      await this.notify(review, 'review.reminder', key, [recipient], context, null)
    })
  }

  private notify(
    review: PerformanceReview,
    type: NotificationType,
    key: string,
    recipients: MailAccount[],
    context: Context,
    actorUserId: string | null
  ) {
    return notificationService.notify(
      review.organizationId,
      recipients,
      {
        type,
        key,
        data: { employeeName: context.employeeName, cycle: context.cycleName },
        link: `/performance/reviews/${review.id}`,
        payload: { reviewId: review.id, employeeId: review.employeeId },
      },
      actorUserId
    )
  }

  /** Accounts and labels of an evaluation; HR = hr_admins, else owners. */
  private context(review: PerformanceReview, withHr: boolean): Promise<Context> {
    const { organizationId } = review
    return withTenant(organizationId, async (trx) => {
      const members = membersIn(organizationId, trx)
      const employee = await employeesIn(organizationId, trx).find(review.employeeId)
      const cycle = review.cycleId ? await cyclesIn(organizationId, trx).find(review.cycleId) : null
      let hr: MailAccount[] = []
      if (withHr) {
        hr = await members.accountsWithRole('hr_admin')
        if (hr.length === 0) hr = await members.accountsWithRole('owner')
      }
      return {
        employee: await members.accountOfEmployee(review.employeeId),
        manager: review.managerId ? await members.accountOfEmployee(review.managerId) : null,
        hr,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : '',
        cycleName: cycle?.name ?? '',
        deadline:
          cycle?.selfEvalClosesAt?.toUTC().toISO() ?? (cycle ? cycle.periodEnd.toISODate() : null),
      }
    })
  }

  private async safely(kind: string, review: PerformanceReview, send: () => Promise<void>) {
    try {
      await send()
    } catch (error) {
      logger.error({ err: error, notification: kind, reviewId: review.id }, 'review.notify_failed')
    }
  }
}

export default new ReviewNotifier()
