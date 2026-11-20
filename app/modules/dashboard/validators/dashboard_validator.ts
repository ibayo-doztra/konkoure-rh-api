import vine from '@vinejs/vine'

/** GET /org/dashboard (06 §3). */
export const dashboardValidator = vine.create({
  period: vine.enum(['week', 'month', 'quarter'] as const).optional(),
})
