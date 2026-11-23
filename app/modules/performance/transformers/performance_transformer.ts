import type PerformanceCycle from '#models/performance_cycle'
import type PerformancePlan from '#models/performance_plan'
import type Goal from '#models/goal'
import type GoalActivity from '#models/goal_activity'
import type Okr from '#models/okr'
import type OkrKeyResult from '#models/okr_key_result'
import type OkrCheckin from '#models/okr_checkin'

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

export function keyResultDto(keyResult: OkrKeyResult) {
  return {
    id: keyResult.id,
    position: keyResult.position,
    title: keyResult.title,
    metric: keyResult.metric,
    targetValue: keyResult.targetValue === null ? null : Number(keyResult.targetValue),
    currentValue: keyResult.currentValue === null ? null : Number(keyResult.currentValue),
    unit: keyResult.unit,
    isDone: keyResult.isDone,
    doneAt: keyResult.doneAt?.toUTC().toISO() ?? null,
  }
}

export function okrDto(okr: Okr, keyResults: OkrKeyResult[]) {
  return {
    id: okr.id,
    employeeId: okr.employeeId,
    quarter: okr.quarter,
    objective: okr.objective,
    status: okr.status,
    reviewStatus: okr.reviewStatus,
    progress: okr.progress,
    submittedAt: okr.submittedAt?.toUTC().toISO() ?? null,
    validatedAt: okr.validatedAt?.toUTC().toISO() ?? null,
    validatedBy: okr.validatedBy,
    managerComment: okr.managerComment,
    keyResults: keyResults.filter((row) => row.okrId === okr.id).map(keyResultDto),
    createdAt: okr.createdAt.toISO(),
    updatedAt: okr.updatedAt.toISO(),
  }
}

export function okrCheckinDto(checkin: OkrCheckin) {
  return {
    id: checkin.id,
    okrId: checkin.okrId,
    authorEmployeeId: checkin.authorEmployeeId,
    message: checkin.message,
    progressSnapshot: checkin.progressSnapshot,
    createdAt: checkin.createdAt.toUTC().toISO(),
  }
}
