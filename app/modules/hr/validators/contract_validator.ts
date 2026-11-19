import vine from '@vinejs/vine'

const TYPES = ['cdi', 'cdd', 'stage', 'freelance', 'apprenticeship', 'daily'] as const
const STATUSES = ['draft', 'active', 'suspended', 'terminated'] as const
/** `terminated` is only reached through POST /:id/terminate. */
const WRITABLE_STATUSES = ['draft', 'active', 'suspended'] as const

const params = () => vine.object({ id: vine.string().uuid() })

const optionalFields = {
  status: vine.enum(WRITABLE_STATUSES).optional(),
  endDate: vine.date().nullable().optional(),
  trialPeriodEnd: vine.date().nullable().optional(),
  salary: vine.number().min(0).max(1_000_000_000).nullable().optional(),
  currency: vine.enum(['GNF'] as const).optional(),
  weeklyHours: vine.number().min(0).max(168).nullable().optional(),
  notes: vine.string().trim().maxLength(5000).nullable().optional(),
}

/** POST /org/contracts (docs/backend/02 §4, 06 §5). */
export const createContractValidator = vine.create({
  employeeId: vine.string().uuid(),
  type: vine.enum(TYPES),
  startDate: vine.date(),
  ...optionalFields,
})

/** PATCH /org/contracts/:id: the employee of a contract never changes. */
export const updateContractValidator = vine.create({
  params: params(),
  type: vine.enum(TYPES).optional(),
  startDate: vine.date().optional(),
  ...optionalFields,
})

export const terminateContractValidator = vine.create({
  params: params(),
  endDate: vine.date().optional(),
})

export const contractIdValidator = vine.create({ params: params() })

export const listContractsValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
  filter: vine
    .object({
      employeeId: vine.string().uuid().optional(),
      status: vine.enum(STATUSES).optional(),
      type: vine.enum(TYPES).optional(),
    })
    .optional(),
})
