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
