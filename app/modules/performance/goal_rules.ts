import type { GoalStatus } from '#models/goal'

/** Total weight of an employee's goals on an active plan (07 §5.2). */
export const MAX_PLAN_WEIGHT = 100

/**
 * Status after a progress change (07 §5.2): 100 % reaches `achieved`, a first
 * step starts the goal, falling back under 100 % reopens it. A cancelled goal
 * stays cancelled; a late one stays late until it is achieved.
 */
export function statusForProgress(current: GoalStatus, progress: number): GoalStatus {
  if (current === 'cancelled') return current
  if (progress >= 100) return 'achieved'
  if (current === 'achieved') return 'in_progress'
  if (current === 'not_started' && progress > 0) return 'in_progress'
  return current
}

/** Statuses that count in the weight budget of a plan. */
export function isWeighted(status: GoalStatus) {
  return status !== 'cancelled'
}
