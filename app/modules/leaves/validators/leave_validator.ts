import vine from '@vinejs/vine'

const TYPES = ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'special'] as const
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const

const params = () => vine.object({ id: vine.string().uuid() })
const year = () => vine.number().withoutDecimals().min(2000).max(2100)

/** POST /org/leaves (docs/backend/06 §7). `requestedDays` is never accepted. */
export const createLeaveValidator = vine.create({
  /** Owner and hr_admin only: the policy checks it. */
  employeeId: vine.string().uuid().optional(),
  type: vine.enum(TYPES),
  startDate: vine.date(),
  /** On or after `startDate`: checked by the service (dates are Luxon after VineJS). */
  endDate: vine.date(),
  halfDayStart: vine.boolean().optional(),
  halfDayEnd: vine.boolean().optional(),
  reason: vine.string().trim().maxLength(1000).nullable().optional(),
})

/** PATCH /org/leaves/:id: the dates are checked together by the service. */
export const updateLeaveValidator = vine.create({
  params: params(),
  type: vine.enum(TYPES).optional(),
  startDate: vine.date().optional(),
  endDate: vine.date().optional(),
  halfDayStart: vine.boolean().optional(),
  halfDayEnd: vine.boolean().optional(),
  reason: vine.string().trim().maxLength(1000).nullable().optional(),
})

export const leaveIdValidator = vine.create({ params: params() })

/** POST /org/leaves/:id/reject: the comment is mandatory (07 §3.5). */
export const rejectLeaveValidator = vine.create({
  params: params(),
  decisionComment: vine.string().trim().minLength(5).maxLength(1000),
})

export const listLeavesValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
  filter: vine
    .object({
      employeeId: vine.string().uuid().optional(),
      status: vine.enum(STATUSES).optional(),
      type: vine.enum(TYPES).optional(),
      from: vine.date().optional(),
      to: vine.date().optional(),
    })
    .optional(),
})

export const listBalancesValidator = vine.create({
  employeeId: vine.string().uuid().optional(),
  year: year().optional(),
})

/** POST /org/leaves/balances/adjust: changes the entitlement, journaled. */
export const adjustBalanceValidator = vine.create({
  employeeId: vine.string().uuid(),
  leaveType: vine.enum(TYPES),
  year: year().optional(),
  /** Non-zero: checked by the service. */
  deltaDays: vine.number().min(-365).max(365).decimal([0, 2]),
  reason: vine.string().trim().minLength(5).maxLength(500),
})

const holidayFields = {
  isMovable: vine.boolean().optional(),
  isRecurring: vine.boolean().optional(),
}

export const createHolidayValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(120),
  date: vine.date(),
  ...holidayFields,
})

export const updateHolidayValidator = vine.create({
  params: params(),
  name: vine.string().trim().minLength(2).maxLength(120).optional(),
  date: vine.date().optional(),
  ...holidayFields,
})

export const holidayIdValidator = vine.create({ params: params() })

export const listHolidaysValidator = vine.create({ year: year().optional() })

export const importHolidaysValidator = vine.create({ year: year() })
