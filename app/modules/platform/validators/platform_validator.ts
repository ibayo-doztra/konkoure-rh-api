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
      deleted: vine.boolean().optional(),
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

const APP_ROLES = [
  'owner',
  'hr_admin',
  'manager',
  'employee',
  'recruiter',
  'security_agent',
] as const

export const listUsersValidator = vine.create({
  ...paging,
  q: vine.string().trim().minLength(1).maxLength(100).optional(),
})

/** PATCH /platform/users/:id/roles: replaces the roles in one organization (empty removes). */
export const updateUserRolesValidator = vine.create({
  params: params(),
  organizationId: vine.string().uuid(),
  roles: vine.array(vine.enum(APP_ROLES)).distinct(),
})

/** Ban and impersonation always carry a reason, kept in the audit trail. */
export const reasonValidator = vine.create({
  params: params(),
  reason: vine.string().trim().minLength(3).maxLength(500),
})

export const grantAdminValidator = vine.create({
  email: vine.string().trim().email().maxLength(254),
  level: vine.enum(['root', 'support'] as const),
})

export const adminUserIdValidator = vine.create({
  params: vine.object({ userId: vine.string().uuid() }),
})

/** PUT /platform/settings (root): known keys only, value checked per key. */
export const updateSettingsValidator = vine.create({
  settings: vine
    .array(vine.object({ key: vine.string().trim().maxLength(100), value: vine.any() }))
    .minLength(1)
    .maxLength(50),
})

const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'expired',
  'refunded',
] as const

export const listPlatformPaymentsValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      status: vine.enum(PAYMENT_STATUSES).optional(),
      failureReason: vine.string().trim().maxLength(60).optional(),
      organizationId: vine.string().uuid().optional(),
    })
    .optional(),
})

const DEMO_STATUSES = ['new', 'contacted', 'scheduled', 'done', 'rejected'] as const

export const listDemoRequestsValidator = vine.create({
  ...paging,
  filter: vine.object({ status: vine.enum(DEMO_STATUSES).optional() }).optional(),
})

export const updateDemoRequestValidator = vine.create({
  params: params(),
  status: vine.enum(DEMO_STATUSES).optional(),
  assignedTo: vine.string().uuid().nullable().optional(),
})

/** POST /public/demo-requests (06 §11). */
export const createDemoRequestValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(120),
  email: vine.string().trim().email().maxLength(254),
  phone: vine.string().trim().minLength(6).maxLength(30),
  companyName: vine.string().trim().minLength(2).maxLength(160),
  companySize: vine.string().trim().minLength(1).maxLength(40),
  message: vine.string().trim().maxLength(2000).optional(),
})

/** GET /platform/logs/:kind (06 §13): cursor pagination, 500 rows at most. */
export const logsValidator = vine.create({
  params: vine.object({ kind: vine.enum(['audit', 'system', 'usage'] as const) }),
  cursor: vine.string().trim().maxLength(500).optional(),
  limit: vine.number().withoutDecimals().min(1).max(500).optional(),
  filter: vine
    .object({
      organizationId: vine.string().uuid().optional(),
      from: vine.date({ formats: ['iso8601'] }).optional(),
      to: vine.date({ formats: ['iso8601'] }).optional(),
      actorUserId: vine.string().uuid().optional(),
      action: vine.string().trim().maxLength(100).optional(),
      channel: vine.string().trim().maxLength(60).optional(),
      level: vine.enum(['debug', 'info', 'warn', 'error', 'fatal'] as const).optional(),
      module: vine.string().trim().maxLength(60).optional(),
    })
    .optional(),
})
