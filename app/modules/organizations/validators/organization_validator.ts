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
