import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type User from '#models/user'
import type PerformanceReview from '#models/performance_review'
import type { ReviewStatus } from '#models/performance_review'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { cyclesIn } from '#modules/performance/repositories/cycle_repository'
import { plansIn } from '#modules/performance/repositories/plan_repository'
import {
  reviewsIn,
  type GoalCommentInput,
  type ReviewRepository,
} from '#modules/performance/repositories/review_repository'
import { isInViewerTeam, visibleEmployeeIds } from '#modules/performance/scope'
import reviewNotifier from '#modules/performance/services/review_notifier'
import { feedbacksIn } from '#modules/performance/repositories/feedback_repository'
import aiService from '#modules/integrations/services/ai_service'
import { reviewSummaryTask } from '#modules/integrations/prompts/review_summary'

export interface ReviewListQuery {
  page?: number
  perPage?: number
  filter?: { cycleId?: string; employeeId?: string; status?: ReviewStatus }
}

export interface SelfInput {
  selfScore?: number | null
  selfGlobalComment?: string | null
  goals?: GoalCommentInput[]
}

export interface ManagerInput {
  managerScore?: number | null
  managerGlobalComment?: string | null
  goals?: GoalCommentInput[]
}

export interface TalentScoresInput {
  performanceScore?: number | null
  potentialScore?: number | null
}

/** 9-box scores apply to a finished evaluation (decision of 2026-11-24). */
const TALENT_SCORABLE: readonly ReviewStatus[] = ['validated', 'signed']

/** The employee still writes the self-evaluation (07 §5.7). */
const SELF_EDITABLE: readonly ReviewStatus[] = ['not_started', 'in_progress', 'sent_back']

/** Reminder of a closing self-evaluation, 7 days ahead (07 §5.8). */
const REMINDER_DAYS = 7

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'status', rule, message }] })

/** Evaluations (docs/backend/06 §9, 07 §5.7 and §5.8). */
export class ReviewService {
  list(tenant: TenantContext, query: ReviewListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const page = await reviewsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        ...query.filter,
        employeeIds: await visibleEmployeeIds(tenant, trx),
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  /** An evaluation and whether the employee is in the viewer's team, for the policy. */
  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const review = await reviewsIn(organizationId, trx).findOrFail(id)
      return { review, inTeam: await isInViewerTeam(tenant, trx, review.employeeId) }
    })
  }

  /** The evaluation with its goals and their comments. */
  view(tenant: TenantContext, review: PerformanceReview) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => this.load(reviewsIn(organizationId, trx), review))
  }

  /**
   * `POST /reviews` (decision of 2026-11-23): one evaluation per employee in
   * an open cycle, all present staff unless `employeeIds` is given. Existing
   * evaluations of the cycle are skipped; with a plan, the employee's goals
   * of that plan are attached.
   */
  async open(
    tenant: TenantContext,
    actor: User,
    input: { cycleId: string; planId?: string; employeeIds?: string[] },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    const result = await withTenant(organizationId, async (trx) => {
      const cycle = await cyclesIn(organizationId, trx).findForUpdate(input.cycleId)
      if (!cycle) throw AppException.validation('cycleId', 'exists', 'validation.performance.cycle')
      if (cycle.status !== 'open')
        throw conflict('cycleNotOpen', 'validation.performance.cycleNotOpen')
      if (input.planId && !(await plansIn(organizationId, trx).find(input.planId))) {
        throw AppException.validation('planId', 'exists', 'validation.performance.plan')
      }

      const employees = employeesIn(organizationId, trx)
      const targets = input.employeeIds
        ? await this.listed(employees, input.employeeIds)
        : await employees.present()
      const reviews = reviewsIn(organizationId, trx)
      const existing = await reviews.employeesInCycle(cycle.id)
      const created: PerformanceReview[] = []
      for (const employee of targets) {
        if (existing.has(employee.id)) continue
        const review = await reviews.create({
          cycleId: cycle.id,
          planId: input.planId ?? null,
          employeeId: employee.id,
          managerId: employee.managerId,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        if (input.planId) await reviews.attachPlanGoals(review.id, input.planId, employee.id)
        created.push(review)
      }
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'review.opened',
        targetType: 'performance_cycle',
        targetId: cycle.id,
        after: {
          planId: input.planId ?? null,
          created: created.length,
          skipped: targets.length - created.length,
        },
      })
      return { created, skipped: targets.length - created.length }
    })
    await reviewNotifier.opened(result.created, actor.id)
    return { created: result.created.map((row) => row.id), skipped: result.skipped }
  }

  /** Self-evaluation draft: `not_started` becomes `in_progress` on the first save. */
  saveSelf(tenant: TenantContext, actor: User, id: string, input: SelfInput, audit: AuditContext) {
    return this.mutate(tenant, actor, id, audit, async (reviews, review) => {
      if (!SELF_EDITABLE.includes(review.status)) {
        throw conflict('selfLocked', 'validation.performance.reviewSelfLocked')
      }
      if (input.goals) {
        await this.assertGoals(reviews, id, input.goals)
        await reviews.upsertComments(id, 'self', input.goals)
      }
      if (input.selfScore !== undefined) review.selfScore = input.selfScore
      if (input.selfGlobalComment !== undefined) review.selfGlobalComment = input.selfGlobalComment
      if (review.status === 'not_started') review.status = 'in_progress'
      return { action: 'review.self_saved', after: { status: review.status } }
    })
  }

  async submitSelf(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const view = await this.mutate(tenant, actor, id, audit, async (_reviews, review) => {
      if (!SELF_EDITABLE.includes(review.status)) {
        throw conflict('selfLocked', 'validation.performance.reviewSelfLocked')
      }
      review.merge({ status: 'submitted', submittedAt: DateTime.now() })
      return { action: 'review.submitted', after: { status: 'submitted' } }
    })
    await reviewNotifier.submitted(view.review, actor.id)
    return view
  }

  /** Manager side, once the employee has submitted. */
  saveManager(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: ManagerInput,
    audit: AuditContext
  ) {
    return this.mutate(tenant, actor, id, audit, async (reviews, review) => {
      if (review.status !== 'submitted') {
        throw conflict('notSubmitted', 'validation.performance.reviewNotSubmitted')
      }
      if (input.goals) {
        await this.assertGoals(reviews, id, input.goals)
        await reviews.upsertComments(id, 'manager', input.goals)
      }
      if (input.managerScore !== undefined) review.managerScore = input.managerScore
      if (input.managerGlobalComment !== undefined) {
        review.managerGlobalComment = input.managerGlobalComment
      }
      return { action: 'review.manager_saved', after: { status: review.status } }
    })
  }

  /** Requires the manager's score and global comment (07 §5.7). */
  async validate(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const view = await this.mutate(tenant, actor, id, audit, async (_reviews, review) => {
      if (review.status !== 'submitted') {
        throw conflict('notSubmitted', 'validation.performance.reviewNotSubmitted')
      }
      if (review.managerScore === null || !review.managerGlobalComment) {
        throw AppException.validation(
          'managerScore',
          'required',
          'validation.performance.reviewManagerIncomplete'
        )
      }
      const now = DateTime.now()
      review.merge({
        status: 'validated',
        managerSubmittedAt: now,
        validatedAt: now,
        validatedBy: actor.id,
      })
      return { action: 'review.validated', after: { status: 'validated' } }
    })
    await reviewNotifier.validated(view.review, actor.id)
    return view
  }

  /** Back to the employee with a mandatory comment (07 §5.7). */
  async sendBack(
    tenant: TenantContext,
    actor: User,
    id: string,
    comment: string,
    audit: AuditContext
  ) {
    const view = await this.mutate(tenant, actor, id, audit, async (_reviews, review) => {
      if (review.status !== 'submitted') {
        throw conflict('notSubmitted', 'validation.performance.reviewNotSubmitted')
      }
      const now = DateTime.now()
      review.merge({
        status: 'sent_back',
        sentBackAt: now,
        sentBackComment: comment,
        managerSubmittedAt: now,
      })
      return { action: 'review.sent_back', after: { status: 'sent_back' } }
    })
    await reviewNotifier.sentBack(view.review, actor.id)
    return view
  }

  /** The evaluated employee signs a validated evaluation; `signed` is terminal. */
  async sign(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const view = await this.mutate(tenant, actor, id, audit, async (_reviews, review) => {
      if (review.status !== 'validated') {
        throw conflict('notValidated', 'validation.performance.reviewNotValidated')
      }
      review.merge({ status: 'signed', signedAt: DateTime.now(), signedBy: actor.id })
      return { action: 'review.signed', after: { status: 'signed' } }
    })
    await reviewNotifier.signed(view.review, actor.id)
    return view
  }

  /**
   * HR scores of the 9-box (07 §5.10): HR fields outside the signed content,
   * so a signed evaluation still accepts them.
   */
  scoreTalent(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: TalentScoresInput,
    audit: AuditContext
  ) {
    return this.mutate(tenant, actor, id, audit, async (_reviews, review) => {
      if (!TALENT_SCORABLE.includes(review.status)) {
        throw conflict('notValidated', 'validation.performance.reviewNotScorable')
      }
      if (input.performanceScore !== undefined) review.performanceScore = input.performanceScore
      if (input.potentialScore !== undefined) review.potentialScore = input.potentialScore
      return {
        action: 'review.talent_scored',
        after: {
          performanceScore: review.performanceScore,
          potentialScore: review.potentialScore,
        },
      }
    })
  }

  /**
   * `POST /reviews/:id/ai-summary` (decision of 2026-11-24): synthesis of the
   * evaluation, its goals and the feedback the manager may read, stored in
   * `ai_summary`. The AI call runs outside any transaction; one credit.
   */
  async aiSummary(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    const input = await withTenant(organizationId, async (trx) => {
      const reviews = reviewsIn(organizationId, trx)
      const review = await reviews.findOrFail(id)
      if (review.status === 'not_started') {
        throw conflict('notStarted', 'validation.performance.reviewNotStarted')
      }
      const cycle = review.cycleId ? await cyclesIn(organizationId, trx).find(review.cycleId) : null
      const to = DateTime.now()
      const from = cycle ? cycle.periodStart.startOf('day') : to.minus({ months: 12 })
      const end = cycle ? DateTime.min(cycle.periodEnd.endOf('day'), to) : to
      const goals = await reviews.goalsOf(review.id)
      const rows = await reviews.commentsOf(review.id)
      const comments = new Map(rows.map((row) => [row.goalId, row]))
      const feedback = await feedbacksIn(organizationId, trx).receivedBetween(
        review.employeeId,
        from,
        end
      )
      return {
        language: actor.preferredLanguage === 'en' ? ('en' as const) : ('fr' as const),
        selfScore: review.selfScore,
        selfComment: review.selfGlobalComment,
        managerScore: review.managerScore,
        managerComment: review.managerGlobalComment,
        goals: goals.map((goal) => ({
          title: goal.title,
          progress: goal.progress,
          status: goal.status,
          selfComment: comments.get(goal.id)?.selfComment ?? null,
          selfRating: comments.get(goal.id)?.selfRating ?? null,
          managerComment: comments.get(goal.id)?.managerComment ?? null,
          managerRating: comments.get(goal.id)?.managerRating ?? null,
        })),
        feedback: feedback.map((row) => ({ kind: row.kind, message: row.message })),
      }
    })

    const { summary } = await aiService.run(reviewSummaryTask(input), {
      organizationId,
      userId: actor.id,
      module: 'performance',
      path: `/org/performance/reviews/${id}/ai-summary`,
    })
    return this.mutate(tenant, actor, id, audit, async (_reviews, review) => {
      review.aiSummary = summary
      return { action: 'review.ai_summary', after: { status: review.status } }
    })
  }

  /**
   * `reviews:reminders` (docs/backend/08 §2, every Monday, decision of
   * 2026-11-23): employees whose self-evaluation closes within 7 days (or is
   * past) and is not submitted, and managers of submitted evaluations.
   */
  async reminders(at: DateTime = DateTime.now()) {
    let reminded = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        const { selfDue, managerDue } = await withTenant(organizationId, async (trx) => {
          const reviews = reviewsIn(organizationId, trx)
          return {
            selfDue: await reviews.selfEvaluationsDue(at.plus({ days: REMINDER_DAYS })),
            managerDue: await reviews.awaitingManager(),
          }
        })
        for (const review of selfDue) await reviewNotifier.reminder(review, 'employee')
        for (const review of managerDue) await reviewNotifier.reminder(review, 'manager')
        reminded += selfDue.length + managerDue.length
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'reviews.reminders_failed')
      }
    }
    logger.info({ reminded, failed: failed.length }, 'reviews.reminders_done')
    if (failed.length > 0) {
      throw new Error(`reviews:reminders failed for ${failed.length} organization(s)`)
    }
    return reminded
  }

  /** Locks the evaluation, applies the change, saves and journals it. */
  private mutate(
    tenant: TenantContext,
    actor: User,
    id: string,
    audit: AuditContext,
    change: (
      reviews: ReviewRepository,
      review: PerformanceReview
    ) => Promise<{ action: string; after: Record<string, unknown> }>
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const reviews = reviewsIn(organizationId, trx)
      const review = await reviews.findForUpdate(id)
      if (!review) throw new AppException('E_NOT_FOUND')
      const before = { status: review.status }
      const { action, after } = await change(reviews, review)
      review.updatedBy = actor.id
      await reviews.save(review)
      await auditService.record(trx, this.context(tenant, audit), {
        action,
        targetType: 'performance_review',
        targetId: id,
        before,
        after,
      })
      await review.refresh()
      return this.load(reviews, review)
    })
  }

  private async load(reviews: ReviewRepository, review: PerformanceReview) {
    return {
      review,
      goals: await reviews.goalsOf(review.id),
      comments: await reviews.commentsOf(review.id),
    }
  }

  private async assertGoals(reviews: ReviewRepository, id: string, items: GoalCommentInput[]) {
    const rows = await reviews.goalsOf(id)
    const goals = new Set(rows.map((goal) => goal.id))
    if (items.some((item) => !goals.has(item.goalId))) {
      throw AppException.validation('goals', 'exists', 'validation.performance.reviewGoal')
    }
  }

  private async listed(employees: ReturnType<typeof employeesIn>, ids: string[]) {
    const rows = []
    for (const id of new Set(ids)) {
      const employee = await employees.find(id)
      if (!employee) {
        throw AppException.validation('employeeIds', 'exists', 'validation.performance.employee')
      }
      rows.push(employee)
    }
    return rows
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new ReviewService()
