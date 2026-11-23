import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Goal, { type GoalCategory, type GoalStatus } from '#models/goal'
import GoalActivity from '#models/goal_activity'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface GoalListFilters {
  page: number
  perPage: number
  employeeId?: string
  planId?: string
  status?: GoalStatus
  category?: GoalCategory
  /** Restricts the list to these employees (team, self). */
  employeeIds?: string[]
}

/** Tenant-scoped goals; those of deleted employee records stay hidden. */
export class GoalRepository extends TenantRepository<typeof Goal> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Goal, organizationId, trx)
  }

  protected override query() {
    return super
      .query()
      .where((query) =>
        query
          .whereNull('employee_id')
          .orWhereIn(
            'employee_id',
            this.trx
              .from('employees')
              .where('organization_id', this.organizationId)
              .whereNull('deleted_at')
              .select('id')
          )
      )
  }

  create(data: Partial<ModelAttributes<Goal>>) {
    return Goal.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: GoalListFilters) {
    const query = this.query()
    if (filters.employeeIds) query.whereIn('employee_id', filters.employeeIds)
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    if (filters.planId) query.where('plan_id', filters.planId)
    if (filters.status) query.where('status', filters.status)
    if (filters.category) query.where('category', filters.category)
    return query
      .orderByRaw('due_date ASC NULLS LAST')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  /** Serializes the weight checks of one employee on one plan (07 §5.2). */
  async lockWeights(planId: string, employeeId: string) {
    await this.trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
      `goal_weights:${planId}:${employeeId}`,
    ])
  }

  /** Weight already allotted to an employee on a plan, `excludeId` aside. */
  async weightOf(planId: string, employeeId: string, excludeId?: string) {
    const query = this.query()
      .where('plan_id', planId)
      .where('employee_id', employeeId)
      .whereNot('status', 'cancelled')
    if (excludeId) query.whereNot('id', excludeId)
    const row = await query.sum('weight as total').first()
    return Number(row?.$extras.total ?? 0)
  }

  /** Whether any employee's goals of the plan weigh more than 100 in total. */
  async planOverflows(planId: string) {
    const rows = await this.query()
      .where('plan_id', planId)
      .whereNotNull('employee_id')
      .whereNot('status', 'cancelled')
      .groupBy('employee_id')
      .havingRaw('sum(weight) > 100')
      .select('employee_id')
    return rows.length > 0
  }

  /** Ids of the goal and its ancestors, to refuse a parent cycle. */
  async ancestorIds(goalId: string): Promise<string[]> {
    const { rows } = await this.trx.rawQuery(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_goal_id, 1 AS depth FROM goals
          WHERE organization_id = ? AND id = ?
         UNION ALL
         SELECT g.id, g.parent_goal_id, chain.depth + 1 FROM goals g
           JOIN chain ON g.id = chain.parent_goal_id
          WHERE g.organization_id = ? AND chain.depth < 50
       )
       SELECT id FROM chain`,
      [this.organizationId, goalId, this.organizationId]
    )
    return (rows as Array<{ id: string }>).map((row) => row.id)
  }

  /** `goals:mark-late` (08 §2): open goals past their due date. */
  async markLate(today: string) {
    const ids = await this.query()
      .whereIn('status', ['not_started', 'in_progress'])
      .where('progress', '<', 100)
      .whereNotNull('due_date')
      .where('due_date', '<', today)
      .select('id')
    if (ids.length === 0) return 0
    await Goal.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereIn(
        'id',
        ids.map((row) => row.id)
      )
      .update({ status: 'late' })
    return ids.length
  }

  activitiesOf(goalId: string) {
    return GoalActivity.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('goal_id', goalId)
      .orderByRaw('planned_date ASC NULLS LAST')
      .orderBy('id', 'asc')
  }

  createActivity(data: Partial<ModelAttributes<GoalActivity>>) {
    return GoalActivity.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }
}

export function goalsIn(organizationId: string, trx: TransactionClientContract) {
  return new GoalRepository(organizationId, trx)
}
