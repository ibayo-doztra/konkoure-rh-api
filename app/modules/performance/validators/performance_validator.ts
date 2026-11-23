import vine from '@vinejs/vine'

const FREQUENCIES = ['annual', 'semestrial', 'quarterly', 'custom'] as const
const CYCLE_STATUSES = ['draft', 'open', 'closed'] as const
const PLAN_STATUSES = ['draft', 'active', 'closed'] as const
const GOAL_CATEGORIES = ['business', 'development', 'behavioral'] as const
const GOAL_STATUSES = ['not_started', 'in_progress', 'achieved', 'late', 'cancelled'] as const
/** `achieved` follows the progress and `late` the nightly job (07 §5.2). */
const WRITABLE_GOAL_STATUSES = ['not_started', 'in_progress', 'cancelled'] as const
const ACTIVITY_STATUSES = ['planned', 'in_progress', 'done'] as const

const params = () => vine.object({ id: vine.string().uuid() })
const name = () => vine.string().trim().minLength(1).maxLength(200)
const paging = {
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
}

export const idValidator = vine.create({ params: params() })

/* Cycles (docs/backend/02 §8, 06 §9) */

const cycleFields = {
  selfEvalOpensAt: vine
    .date({ formats: ['iso8601'] })
    .nullable()
    .optional(),
  selfEvalClosesAt: vine
    .date({ formats: ['iso8601'] })
    .nullable()
    .optional(),
}

export const listCyclesValidator = vine.create({
  ...paging,
  filter: vine.object({ status: vine.enum(CYCLE_STATUSES).optional() }).optional(),
})

export const createCycleValidator = vine.create({
  name: name(),
  frequency: vine.enum(FREQUENCIES),
  periodStart: vine.date(),
  periodEnd: vine.date(),
  ...cycleFields,
})

export const updateCycleValidator = vine.create({
  params: params(),
  name: name().optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  periodStart: vine.date().optional(),
  periodEnd: vine.date().optional(),
  ...cycleFields,
})

/* Plans */

export const listPlansValidator = vine.create({
  ...paging,
  filter: vine.object({ status: vine.enum(PLAN_STATUSES).optional() }).optional(),
})

export const createPlanValidator = vine.create({
  name: name(),
  periodStart: vine.date(),
  periodEnd: vine.date(),
  status: vine.enum(PLAN_STATUSES).optional(),
})

export const updatePlanValidator = vine.create({
  params: params(),
  name: name().optional(),
  periodStart: vine.date().optional(),
  periodEnd: vine.date().optional(),
  status: vine.enum(PLAN_STATUSES).optional(),
})

/* Goals (07 §5.2) */

const goalFields = {
  description: vine.string().trim().maxLength(5000).nullable().optional(),
  measurement: vine.string().trim().maxLength(2000).nullable().optional(),
  category: vine.enum(GOAL_CATEGORIES).optional(),
  weight: vine.number().withoutDecimals().min(0).max(100).optional(),
  startDate: vine.date().nullable().optional(),
  dueDate: vine.date().nullable().optional(),
  planId: vine.string().uuid().nullable().optional(),
  parentGoalId: vine.string().uuid().nullable().optional(),
  ownerId: vine.string().uuid().nullable().optional(),
}

export const listGoalsValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      employeeId: vine.string().uuid().optional(),
      planId: vine.string().uuid().optional(),
      status: vine.enum(GOAL_STATUSES).optional(),
      category: vine.enum(GOAL_CATEGORIES).optional(),
    })
    .optional(),
})

/** POST /org/performance/goals: `employeeId` defaults to the caller's record. */
export const createGoalValidator = vine.create({
  employeeId: vine.string().uuid().optional(),
  title: vine.string().trim().minLength(1).maxLength(500),
  ...goalFields,
})

/** PATCH /org/performance/goals/:id: the holder of a goal never changes. */
export const updateGoalValidator = vine.create({
  params: params(),
  title: vine.string().trim().minLength(1).maxLength(500).optional(),
  status: vine.enum(WRITABLE_GOAL_STATUSES).optional(),
  ...goalFields,
})

export const goalProgressValidator = vine.create({
  params: params(),
  progress: vine.number().withoutDecimals().min(0).max(100),
})

export const createActivityValidator = vine.create({
  params: params(),
  title: vine.string().trim().minLength(1).maxLength(500),
  description: vine.string().trim().maxLength(5000).nullable().optional(),
  status: vine.enum(ACTIVITY_STATUSES).optional(),
  plannedDate: vine.date().nullable().optional(),
  employeeId: vine.string().uuid().nullable().optional(),
})

/** PATCH /goals/:id/activities/:activityId (added 2026-11-23). */
export const updateActivityValidator = vine.create({
  params: vine.object({ id: vine.string().uuid(), activityId: vine.string().uuid() }),
  title: vine.string().trim().minLength(1).maxLength(500).optional(),
  description: vine.string().trim().maxLength(5000).nullable().optional(),
  status: vine.enum(ACTIVITY_STATUSES).optional(),
  plannedDate: vine.date().nullable().optional(),
})

export const activityIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid(), activityId: vine.string().uuid() }),
})

/** GET /performance/activities (added 2026-11-23). */
export const listActivitiesValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(200).optional(),
  filter: vine
    .object({
      goalId: vine.string().uuid().optional(),
      employeeId: vine.string().uuid().optional(),
      status: vine.enum(ACTIVITY_STATUSES).optional(),
    })
    .optional(),
})

/* OKR (07 §5.3) */

const OKR_STATUSES = ['draft', 'active', 'completed', 'archived'] as const
const OKR_REVIEW_STATUSES = ['draft', 'pending', 'validated', 'needs_revision'] as const
const quarter = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{4}-Q[1-4]$/)
const objective = () => vine.string().trim().minLength(1).maxLength(1000)
const amount = () => vine.number().min(-1_000_000_000_000).max(1_000_000_000_000)

export const listOkrsValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      employeeId: vine.string().uuid().optional(),
      quarter: quarter().optional(),
      status: vine.enum(OKR_STATUSES).optional(),
      reviewStatus: vine.enum(OKR_REVIEW_STATUSES).optional(),
    })
    .optional(),
})

/** POST /okrs: `employeeId` defaults to the caller's record. */
export const createOkrValidator = vine.create({
  employeeId: vine.string().uuid().optional(),
  quarter: quarter(),
  objective: objective(),
})

export const updateOkrValidator = vine.create({
  params: params(),
  quarter: quarter().optional(),
  objective: objective().optional(),
})

export const replaceKeyResultsValidator = vine.create({
  params: params(),
  keyResults: vine
    .array(
      vine.object({
        title: vine.string().trim().minLength(1).maxLength(500),
        metric: vine.string().trim().maxLength(200).nullable().optional(),
        targetValue: amount().nullable().optional(),
        currentValue: amount().nullable().optional(),
        unit: vine.string().trim().maxLength(50).nullable().optional(),
        isDone: vine.boolean().optional(),
      })
    )
    .maxLength(20),
})

export const updateKeyResultValidator = vine.create({
  params: vine.object({ id: vine.string().uuid(), krId: vine.string().uuid() }),
  isDone: vine.boolean().optional(),
  currentValue: amount().nullable().optional(),
})

export const validateOkrValidator = vine.create({
  params: params(),
  comment: vine.string().trim().minLength(1).maxLength(2000).optional(),
})

/** The comment of a send-back is mandatory (07 §5.3). */
export const requestRevisionValidator = vine.create({
  params: params(),
  comment: vine.string().trim().minLength(1).maxLength(2000),
})

export const createCheckinValidator = vine.create({
  params: params(),
  message: vine.string().trim().minLength(1).maxLength(5000),
})

/* Evaluations (07 §5.7) */

const REVIEW_STATUSES = [
  'not_started',
  'in_progress',
  'submitted',
  'sent_back',
  'validated',
  'signed',
] as const
const score = () => vine.number().withoutDecimals().min(1).max(5)
const globalComment = () => vine.string().trim().maxLength(10_000)
const goalComments = () =>
  vine
    .array(
      vine.object({
        goalId: vine.string().uuid(),
        comment: vine.string().trim().maxLength(5000).nullable().optional(),
        rating: score().nullable().optional(),
      })
    )
    .maxLength(100)

export const listReviewsValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      cycleId: vine.string().uuid().optional(),
      employeeId: vine.string().uuid().optional(),
      status: vine.enum(REVIEW_STATUSES).optional(),
    })
    .optional(),
})

/** POST /reviews (decision of 2026-11-23): mass opening on an open cycle. */
export const openReviewsValidator = vine.create({
  cycleId: vine.string().uuid(),
  planId: vine.string().uuid().optional(),
  employeeIds: vine.array(vine.string().uuid()).minLength(1).maxLength(1000).optional(),
})

export const selfReviewValidator = vine.create({
  params: params(),
  selfScore: score().nullable().optional(),
  selfGlobalComment: globalComment().nullable().optional(),
  goals: goalComments().optional(),
})

export const managerReviewValidator = vine.create({
  params: params(),
  managerScore: score().nullable().optional(),
  managerGlobalComment: globalComment().nullable().optional(),
  goals: goalComments().optional(),
})

/** The comment of a send-back is mandatory (07 §5.7). */
export const sendBackReviewValidator = vine.create({
  params: params(),
  comment: vine.string().trim().minLength(1).maxLength(5000),
})

/* Feedback and achievements (07 §5.9) */

const FEEDBACK_KINDS = ['kudos', 'suggestion', 'concern'] as const

export const listFeedbackValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      toEmployeeId: vine.string().uuid().optional(),
      kind: vine.enum(FEEDBACK_KINDS).optional(),
    })
    .optional(),
})

export const createFeedbackValidator = vine.create({
  toEmployeeId: vine.string().uuid(),
  kind: vine.enum(FEEDBACK_KINDS),
  message: vine.string().trim().minLength(1).maxLength(5000),
  okrId: vine.string().uuid().nullable().optional(),
  goalId: vine.string().uuid().nullable().optional(),
  isPrivate: vine.boolean().optional(),
  visibleToManager: vine.boolean().optional(),
})

export const listAchievementsValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      employeeId: vine.string().uuid().optional(),
      goalId: vine.string().uuid().optional(),
    })
    .optional(),
})

/** POST /achievements: `employeeId` defaults to the caller's record. */
export const createAchievementValidator = vine.create({
  employeeId: vine.string().uuid().optional(),
  goalId: vine.string().uuid().nullable().optional(),
  title: vine.string().trim().minLength(1).maxLength(500),
  description: vine.string().trim().maxLength(5000).nullable().optional(),
  impact: vine.string().trim().maxLength(5000).nullable().optional(),
  achievedAt: vine.date({ formats: ['iso8601'] }),
})
