import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import PerformanceReview, { type ReviewStatus } from '#models/performance_review'
import ReviewGoalComment from '#models/review_goal_comment'
import Goal from '#models/goal'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface ReviewListFilters {
  page: number
  perPage: number
  cycleId?: string
  employeeId?: string
  status?: ReviewStatus
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

export interface GoalCommentInput {
  goalId: string
  comment?: string | null
  rating?: number | null
}

/** Not submitted by the employee yet (07 §5.7). */
const SELF_PENDING: ReviewStatus[] = ['not_started', 'in_progress', 'sent_back']

/** Tenant-scoped evaluations; those of deleted employee records stay hidden. */
export class ReviewRepository extends TenantRepository<typeof PerformanceReview> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(PerformanceReview, organizationId, trx)
  }

  protected override query() {
    return super
      .query()
      .whereIn(
        'employee_id',
        this.trx
          .from('employees')
          .where('organization_id', this.organizationId)
          .whereNull('deleted_at')
          .select('id')
      )
  }

  create(data: Partial<ModelAttributes<PerformanceReview>>) {
    return PerformanceReview.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  paginate(filters: ReviewListFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.cycleId) query.where('cycle_id', filters.cycleId)
    if (filters.status) query.where('status', filters.status)
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  /** Evaluations of a cycle, optionally limited to some employees (9-box). */
  ofCycle(cycleId: string, employeeIds?: string[]) {
    const query = this.query().where('cycle_id', cycleId)
    if (employeeIds) query.whereIn('employee_id', employeeIds)
    return query.orderBy('id', 'asc')
  }

  /** Employees who already have an evaluation in the cycle. */
  async employeesInCycle(cycleId: string): Promise<Set<string>> {
    const rows = await PerformanceReview.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('cycle_id', cycleId)
      .select('employee_id')
    return new Set(rows.map((row) => row.employeeId))
  }

  /** Goals of the employee on the plan that no evaluation holds yet. */
  async attachPlanGoals(reviewId: string, planId: string, employeeId: string) {
    await Goal.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('plan_id', planId)
      .where('employee_id', employeeId)
      .whereNull('review_id')
      .whereNull('deleted_at')
      .whereNot('status', 'cancelled')
      .update({ review_id: reviewId })
  }

  goalsOf(reviewId: string) {
    return Goal.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('review_id', reviewId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
  }

  commentsOf(reviewId: string) {
    return ReviewGoalComment.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('review_id', reviewId)
  }

  /** Writes the self or manager side of each goal comment, keeping the other side. */
  async upsertComments(reviewId: string, side: 'self' | 'manager', items: GoalCommentInput[]) {
    const rows = await this.commentsOf(reviewId)
    const existing = new Map(rows.map((row) => [row.goalId, row] as const))
    for (const item of items) {
      const row =
        existing.get(item.goalId) ??
        new ReviewGoalComment().merge({
          organizationId: this.organizationId,
          reviewId,
          goalId: item.goalId,
        })
      if (side === 'self') {
        if (item.comment !== undefined) row.selfComment = item.comment
        if (item.rating !== undefined) row.selfRating = item.rating
      } else {
        if (item.comment !== undefined) row.managerComment = item.comment
        if (item.rating !== undefined) row.managerRating = item.rating
      }
      row.useTransaction(this.trx)
      await row.save()
    }
  }

  /** Reviews of open cycles whose self-evaluation closes by `until` and is not submitted. */
  selfEvaluationsDue(until: DateTime) {
    return this.query()
      .whereIn('status', SELF_PENDING)
      .whereIn(
        'cycle_id',
        this.trx
          .from('performance_cycles')
          .where('organization_id', this.organizationId)
          .where('status', 'open')
          .whereNull('deleted_at')
          .whereNotNull('self_eval_closes_at')
          .where('self_eval_closes_at', '<=', until.toUTC().toISO()!)
          .select('id')
      )
  }

  /** Submitted reviews of open cycles still waiting for their manager. */
  awaitingManager() {
    return this.query()
      .where('status', 'submitted')
      .whereNotNull('manager_id')
      .whereIn(
        'cycle_id',
        this.trx
          .from('performance_cycles')
          .where('organization_id', this.organizationId)
          .where('status', 'open')
          .whereNull('deleted_at')
          .select('id')
      )
  }
}

export function reviewsIn(organizationId: string, trx: TransactionClientContract) {
  return new ReviewRepository(organizationId, trx)
}
