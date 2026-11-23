import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type User from '#models/user'
import type Feedback from '#models/feedback'
import type { FeedbackKind } from '#models/feedback'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import notificationService from '#modules/notifications/services/notification_service'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import { feedbacksIn } from '#modules/performance/repositories/feedback_repository'
import { goalsIn } from '#modules/performance/repositories/goal_repository'
import { okrsIn } from '#modules/performance/repositories/okr_repository'

export interface FeedbackInput {
  toEmployeeId: string
  kind: FeedbackKind
  message: string
  okrId?: string | null
  goalId?: string | null
  isPrivate?: boolean
  visibleToManager?: boolean
}

export interface FeedbackListQuery {
  page?: number
  perPage?: number
  filter?: { toEmployeeId?: string; kind?: FeedbackKind }
}

/** Continuous feedback (docs/backend/06 §9, 07 §5.9, 04 §5 "Performance"). */
export class FeedbackService {
  list(tenant: TenantContext, user: User, query: FeedbackListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      let audience
      if (!tenant.hasRole('owner', 'hr_admin')) {
        const self = tenant.employeeId
        const team =
          self && tenant.hasRole('manager')
            ? await employeesIn(organizationId, trx).teamIds(self)
            : []
        audience = { employeeId: self, userId: user.id, team }
      }
      const page = await feedbacksIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        ...query.filter,
        audience,
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => feedbacksIn(organizationId, trx).findOrFail(id))
  }

  /** The author is the caller's employee record; a `concern` also alerts HR (07 §5.9). */
  async create(tenant: TenantContext, actor: User, input: FeedbackInput, audit: AuditContext) {
    const { organizationId } = tenant
    const feedback = await withTenant(organizationId, async (trx) => {
      if (!(await employeesIn(organizationId, trx).find(input.toEmployeeId))) {
        throw AppException.validation('toEmployeeId', 'exists', 'validation.performance.employee')
      }
      if (input.toEmployeeId === tenant.employeeId) {
        throw AppException.validation('toEmployeeId', 'self', 'validation.performance.feedbackSelf')
      }
      if (input.okrId && !(await okrsIn(organizationId, trx).find(input.okrId))) {
        throw AppException.validation('okrId', 'exists', 'validation.performance.okr')
      }
      if (input.goalId && !(await goalsIn(organizationId, trx).find(input.goalId))) {
        throw AppException.validation('goalId', 'exists', 'validation.performance.goal')
      }
      const row = await feedbacksIn(organizationId, trx).create({
        ...input,
        okrId: input.okrId ?? null,
        goalId: input.goalId ?? null,
        fromEmployeeId: tenant.employeeId,
        createdBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'feedback.created',
        targetType: 'feedback',
        targetId: row.id,
        after: { toEmployeeId: input.toEmployeeId, kind: input.kind, isPrivate: row.isPrivate },
      })
      await row.refresh()
      return row
    })
    await this.notify(feedback, actor)
    return feedback
  }

  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const feedbacks = feedbacksIn(organizationId, trx)
      const feedback = await feedbacks.findForUpdate(id)
      if (!feedback) throw new AppException('E_NOT_FOUND')
      feedback.merge({ deletedAt: DateTime.now() })
      await feedbacks.save(feedback)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'feedback.deleted',
        targetType: 'feedback',
        targetId: id,
        before: { toEmployeeId: feedback.toEmployeeId, kind: feedback.kind },
      })
    })
  }

  /**
   * `feedback.received` to the recipient, author masked when private; a
   * `concern` also goes to the hr_admins, else the owners. After the commit,
   * never raised.
   */
  private async notify(feedback: Feedback, actor: User) {
    try {
      const { organizationId } = feedback
      const { recipient, hr, recipientName, authorName } = await withTenant(
        organizationId,
        async (trx) => {
          const members = membersIn(organizationId, trx)
          const employees = employeesIn(organizationId, trx)
          const names = await employees.namesOf(
            [feedback.toEmployeeId, feedback.fromEmployeeId].filter(
              (id): id is string => id !== null
            )
          )
          let accounts: MailAccount[] = []
          if (feedback.kind === 'concern') {
            accounts = await members.accountsWithRole('hr_admin')
            if (accounts.length === 0) accounts = await members.accountsWithRole('owner')
          }
          return {
            recipient: await members.accountOfEmployee(feedback.toEmployeeId),
            hr: accounts,
            recipientName: names.get(feedback.toEmployeeId) ?? '',
            authorName: feedback.fromEmployeeId
              ? (names.get(feedback.fromEmployeeId) ?? '')
              : (actor.fullName ?? ''),
          }
        }
      )
      const base = {
        type: 'feedback.received' as const,
        link: '/performance/feedback',
        payload: { feedbackId: feedback.id, kind: feedback.kind },
      }
      if (recipient) {
        await notificationService.notify(
          organizationId,
          [recipient],
          {
            ...base,
            key: feedback.isPrivate ? 'feedbackReceivedPrivate' : 'feedbackReceived',
            data: { authorName },
          },
          actor.id
        )
      }
      const alerted = hr.filter((account) => account.id !== recipient?.id)
      if (alerted.length > 0) {
        await notificationService.notify(
          organizationId,
          alerted,
          { ...base, key: 'feedbackConcern', data: { employeeName: recipientName, authorName } },
          actor.id
        )
      }
    } catch (error) {
      logger.error({ err: error, feedbackId: feedback.id }, 'feedback.notify_failed')
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new FeedbackService()
