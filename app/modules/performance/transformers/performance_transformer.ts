import type PerformanceCycle from '#models/performance_cycle'
import type PerformancePlan from '#models/performance_plan'
import type Goal from '#models/goal'
import type GoalActivity from '#models/goal_activity'
import type Okr from '#models/okr'
import type OkrKeyResult from '#models/okr_key_result'
import type OkrCheckin from '#models/okr_checkin'
import type PerformanceReview from '#models/performance_review'
import type ReviewGoalComment from '#models/review_goal_comment'
import type Feedback from '#models/feedback'
import type Achievement from '#models/achievement'

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

/** The manager's side reaches the evaluated employee only from these states (07 §5.7). */
const MANAGER_VISIBLE = new Set(['sent_back', 'validated', 'signed'])

export function reviewSummaryDto(review: PerformanceReview) {
  return {
    id: review.id,
    cycleId: review.cycleId,
    planId: review.planId,
    employeeId: review.employeeId,
    managerId: review.managerId,
    status: review.status,
    submittedAt: review.submittedAt?.toUTC().toISO() ?? null,
    validatedAt: review.validatedAt?.toUTC().toISO() ?? null,
    signedAt: review.signedAt?.toUTC().toISO() ?? null,
    createdAt: review.createdAt.toISO(),
    updatedAt: review.updatedAt.toISO(),
  }
}

/**
 * Evaluation detail. `ownView`: the reader is the evaluated employee, who
 * sees the manager's scores and comments only once sent back, validated or
 * signed.
 */
export function reviewDto(
  view: { review: PerformanceReview; goals: Goal[]; comments: ReviewGoalComment[] },
  ownView: boolean
) {
  const { review } = view
  const showManager = !ownView || MANAGER_VISIBLE.has(review.status)
  const comments = new Map(view.comments.map((row) => [row.goalId, row]))
  return {
    ...reviewSummaryDto(review),
    selfScore: review.selfScore,
    selfGlobalComment: review.selfGlobalComment,
    managerScore: showManager ? review.managerScore : null,
    managerGlobalComment: showManager ? review.managerGlobalComment : null,
    managerSubmittedAt: showManager ? (review.managerSubmittedAt?.toUTC().toISO() ?? null) : null,
    sentBackAt: review.sentBackAt?.toUTC().toISO() ?? null,
    sentBackComment: review.sentBackComment,
    validatedBy: review.validatedBy,
    signedBy: review.signedBy,
    // 9-box scores: never shown to the evaluated employee (04 §5 "talents").
    performanceScore: ownView ? null : review.performanceScore,
    potentialScore: ownView ? null : review.potentialScore,
    goals: view.goals.map((goal) => {
      const row = comments.get(goal.id)
      return {
        ...goalDto(goal),
        selfComment: row?.selfComment ?? null,
        selfRating: row?.selfRating ?? null,
        managerComment: showManager ? (row?.managerComment ?? null) : null,
        managerRating: showManager ? (row?.managerRating ?? null) : null,
      }
    }),
  }
}

/**
 * Feedback. A private one hides its author from everyone but HR and the
 * author (07 §5.9): `revealAuthor` is decided by the caller.
 */
export function feedbackDto(feedback: Feedback, revealAuthor: boolean) {
  const hidden = feedback.isPrivate && !revealAuthor
  return {
    id: feedback.id,
    fromEmployeeId: hidden ? null : feedback.fromEmployeeId,
    toEmployeeId: feedback.toEmployeeId,
    kind: feedback.kind,
    message: feedback.message,
    okrId: feedback.okrId,
    goalId: feedback.goalId,
    isPrivate: feedback.isPrivate,
    visibleToManager: feedback.visibleToManager,
    createdAt: feedback.createdAt.toUTC().toISO(),
  }
}

export function achievementDto(achievement: Achievement) {
  return {
    id: achievement.id,
    employeeId: achievement.employeeId,
    goalId: achievement.goalId,
    title: achievement.title,
    description: achievement.description,
    impact: achievement.impact,
    achievedAt: achievement.achievedAt.toUTC().toISO(),
    createdBy: achievement.createdBy,
    createdAt: achievement.createdAt.toUTC().toISO(),
  }
}
