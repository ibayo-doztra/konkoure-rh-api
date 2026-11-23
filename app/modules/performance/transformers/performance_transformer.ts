import type PerformanceCycle from '#models/performance_cycle'
import type PerformancePlan from '#models/performance_plan'
import type Goal from '#models/goal'
import type GoalActivity from '#models/goal_activity'

export function cycleDto(cycle: PerformanceCycle) {
  return {
    id: cycle.id,
    name: cycle.name,
    frequency: cycle.frequency,
    periodStart: cycle.periodStart.toISODate(),
    periodEnd: cycle.periodEnd.toISODate(),
    selfEvalOpensAt: cycle.selfEvalOpensAt?.toUTC().toISO() ?? null,
    selfEvalClosesAt: cycle.selfEvalClosesAt?.toUTC().toISO() ?? null,
    status: cycle.status,
    createdAt: cycle.createdAt.toISO(),
    updatedAt: cycle.updatedAt.toISO(),
  }
}

export function planDto(plan: PerformancePlan) {
  return {
    id: plan.id,
    name: plan.name,
    periodStart: plan.periodStart.toISODate(),
    periodEnd: plan.periodEnd.toISODate(),
    status: plan.status,
    createdAt: plan.createdAt.toISO(),
    updatedAt: plan.updatedAt.toISO(),
  }
}

export function goalDto(goal: Goal) {
  return {
    id: goal.id,
    employeeId: goal.employeeId,
    ownerId: goal.ownerId,
    planId: goal.planId,
    reviewId: goal.reviewId,
    parentGoalId: goal.parentGoalId,
    title: goal.title,
    description: goal.description,
    measurement: goal.measurement,
    category: goal.category,
    weight: goal.weight,
    progress: goal.progress,
    status: goal.status,
    startDate: goal.startDate?.toISODate() ?? null,
    dueDate: goal.dueDate?.toISODate() ?? null,
    createdAt: goal.createdAt.toISO(),
    updatedAt: goal.updatedAt.toISO(),
  }
}

export function goalActivityDto(activity: GoalActivity) {
  return {
    id: activity.id,
    goalId: activity.goalId,
    employeeId: activity.employeeId,
    title: activity.title,
    description: activity.description,
    status: activity.status,
    plannedDate: activity.plannedDate?.toISODate() ?? null,
    completedAt: activity.completedAt?.toUTC().toISO() ?? null,
    createdAt: activity.createdAt.toISO(),
  }
}
