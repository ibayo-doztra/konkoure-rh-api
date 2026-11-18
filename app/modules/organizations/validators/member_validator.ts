import vine from '@vinejs/vine'

const ROLES = ['owner', 'hr_admin', 'manager', 'employee', 'recruiter', 'security_agent'] as const

/** GET /org/members: offset pagination (docs/backend/01 §7). */
export const listMembersValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
})

export const memberIdValidator = vine.create({
  params: vine.object({ userId: vine.string().uuid() }),
})

/** PATCH /org/members/:userId/roles: the complete list of roles to hold. */
export const updateMemberRolesValidator = vine.create({
  params: vine.object({ userId: vine.string().uuid() }),
  roles: vine.array(vine.enum(ROLES)).minLength(1).maxLength(ROLES.length).distinct(),
})
