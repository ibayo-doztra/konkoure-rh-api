import vine from '@vinejs/vine'

const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'canceled',
  'expired',
] as const
const MODULES = [
  'hr',
  'timeclock',
  'leaves',
  'performance',
  'recruitment',
  'talents',
  'settings',
  'integrations',
  'api',
] as const

const params = () => vine.object({ id: vine.string().uuid() })
const paging = {
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
}

export const idValidator = vine.create({ params: params() })

export const listOrganizationsValidator = vine.create({
  ...paging,
  q: vine.string().trim().minLength(1).maxLength(100).optional(),
  filter: vine
    .object({
      status: vine.enum(SUBSCRIPTION_STATUSES).optional(),
      plan: vine.string().trim().maxLength(40).optional(),
    })
    .optional(),
})

/** PATCH /platform/organizations/:id/subscription (root, 06 §13). */
export const updateSubscriptionValidator = vine.create({
  params: params(),
  planId: vine.string().uuid().optional(),
  status: vine.enum(SUBSCRIPTION_STATUSES).optional(),
  cycle: vine.enum(['monthly', 'yearly'] as const).optional(),
  currentPeriodEnd: vine.date({ formats: ['iso8601'] }).optional(),
  trialEndsAt: vine
    .date({ formats: ['iso8601'] })
    .nullable()
    .optional(),
  maxEmployeesOverride: vine.number().withoutDecimals().min(1).max(1_000_000).nullable().optional(),
  modulesOverride: vine.array(vine.enum(MODULES)).distinct().nullable().optional(),
})

const name = () => vine.string().trim().minLength(2).maxLength(80)
const price = () => vine.number().min(0).max(1_000_000_000_000)
const modules = () => vine.array(vine.enum(MODULES)).distinct()
const features = () => vine.array(vine.string().trim().maxLength(80)).maxLength(50)

export const createPlanValidator = vine.create({
  code: vine
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_-]{1,39}$/),
  name: name(),
  priceGnf: price(),
  priceYearlyGnf: price().nullable().optional(),
  maxEmployees: vine.number().withoutDecimals().min(1).max(1_000_000),
  aiCreditsPerMonth: vine.number().withoutDecimals().min(0).max(1_000_000).optional(),
  modules: modules(),
  features: features().optional(),
  sortOrder: vine.number().withoutDecimals().min(0).max(1000).optional(),
  isPublic: vine.boolean().optional(),
})

/** The code never changes: subscriptions and the front refer to it. */
export const updatePlanValidator = vine.create({
  params: params(),
  name: name().optional(),
  priceGnf: price().optional(),
  priceYearlyGnf: price().nullable().optional(),
  maxEmployees: vine.number().withoutDecimals().min(1).max(1_000_000).optional(),
  aiCreditsPerMonth: vine.number().withoutDecimals().min(0).max(1_000_000).optional(),
  modules: modules().optional(),
  features: features().optional(),
  sortOrder: vine.number().withoutDecimals().min(0).max(1000).optional(),
  isPublic: vine.boolean().optional(),
})
