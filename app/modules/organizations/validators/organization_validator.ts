import vine from '@vinejs/vine'

/**
 * POST /organizations (06-api-reference §3). The slug is generated server-side
 * from the name; any client-sent `slug` is ignored.
 */
export const createOrganizationValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(120),
  defaultLanguage: vine.enum(['fr', 'en'] as const).optional(),
  performanceModel: vine.enum(['classic', 'sap'] as const).optional(),
})

/** PATCH /org. GNF is the only currency (docs/00-HANDOFF §4). */
export const updateOrganizationValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(120).optional(),
  defaultLanguage: vine.enum(['fr', 'en'] as const).optional(),
  defaultCurrency: vine.enum(['GNF'] as const).optional(),
  timezone: vine.string().trim().minLength(1).maxLength(64).optional(),
  performanceModel: vine.enum(['classic', 'sap'] as const).optional(),
})

const days = () => vine.number().withoutDecimals().min(0).max(365).optional()

/** PUT /org/settings: the whole block of 02 §11, absent keys take their default. */
export const updateOrganizationSettingsValidator = vine.create({
  leave: vine
    .object({
      annualEntitlementDays: days(),
      allowNegativeBalance: vine.boolean().optional(),
      maxNegativeDays: days(),
      countWeekends: vine.boolean().optional(),
      countHolidays: vine.boolean().optional(),
      maxCarryOverDays: days(),
    })
    .optional(),
  timeclock: vine
    .object({
      defaultRadiusMeters: vine.number().withoutDecimals().min(1).max(100_000).optional(),
      requireZone: vine.boolean().optional(),
      allowManualPunch: vine.boolean().optional(),
      maxAccuracyMeters: vine.number().withoutDecimals().min(1).max(10_000).optional(),
      duplicateWindowSeconds: vine.number().withoutDecimals().min(0).max(3600).optional(),
    })
    .optional(),
  performance: vine
    .object({
      ratingScale: vine.number().withoutDecimals().min(2).max(10).optional(),
      requireSignature: vine.boolean().optional(),
    })
    .optional(),
  recruitment: vine
    .object({
      autoScore: vine.boolean().optional(),
      notifyOnApplication: vine.boolean().optional(),
    })
    .optional(),
  branding: vine
    .object({
      primaryColor: vine
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    })
    .optional(),
})

/** POST /org/logo: size and real type are checked by the logo service. */
export const organizationLogoValidator = vine.create({
  logo: vine.file(),
})

/** DELETE /org: the exact name confirms the deletion. */
export const deleteOrganizationValidator = vine.create({
  confirmName: vine.string().maxLength(120),
})
