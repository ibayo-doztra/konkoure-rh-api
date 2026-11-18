import vine from '@vinejs/vine'

const ROLES = ['owner', 'hr_admin', 'manager', 'employee', 'recruiter', 'security_agent'] as const

/** POST /org/invitations (06-api-reference §3). */
export const createInvitationValidator = vine.create({
  email: vine.string().trim().email().maxLength(255).toLowerCase(),
  role: vine.enum(ROLES),
  employeeId: vine.string().uuid().optional(),
})

/** GET /org/invitations — offset pagination (01 §7), status filter whitelist. */
export const listInvitationsValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
  filter: vine
    .object({
      status: vine.enum(['pending', 'accepted', 'revoked', 'expired'] as const).optional(),
    })
    .optional(),
})

export const invitationIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid() }),
})

/** Token of the public invitation link: opaque, bounded. */
export const invitationTokenValidator = vine.create({
  params: vine.object({ token: vine.string().trim().minLength(20).maxLength(128) }),
})

/**
 * POST /auth/invitations/:token/accept. A new account chooses its password;
 * an existing account proves it with its current password.
 */
export const acceptInvitationValidator = vine.create({
  params: vine.object({ token: vine.string().trim().minLength(20).maxLength(128) }),
  password: vine.string().minLength(1).maxLength(128).confirmed(),
  fullName: vine.string().trim().minLength(2).maxLength(120).optional(),
})
