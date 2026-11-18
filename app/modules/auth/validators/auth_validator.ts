import vine from '@vinejs/vine'

/**
 * Request validators of 06-api-reference §1. E-mails are lower-cased rather than
 * provider-normalized, so imported accounts keep matching their stored address.
 */
const email = () => vine.string().trim().email().maxLength(255).toLowerCase()
const newPassword = () => vine.string().minLength(10).maxLength(128).confirmed()

export const registerValidator = vine.create({
  email: email(),
  password: newPassword(),
  fullName: vine.string().trim().minLength(2).maxLength(120),
  preferredLanguage: vine.enum(['fr', 'en'] as const).optional(),
  acceptTerms: vine.accepted(),
})

export const loginValidator = vine.create({
  email: email(),
  password: vine.string().minLength(1).maxLength(128),
  deviceLabel: vine.string().trim().maxLength(120).optional(),
  rememberDevice: vine.boolean().optional(),
})

/** The web client sends no body: its refresh token is in the httpOnly cookie. */
export const refreshValidator = vine.create({
  refreshToken: vine.string().trim().maxLength(512).optional(),
})

export const forgotPasswordValidator = vine.create({
  email: email(),
})

export const resetPasswordValidator = vine.create({
  token: vine.string().trim().minLength(10).maxLength(512),
  password: newPassword(),
})

export const verifyEmailValidator = vine.create({
  token: vine.string().trim().minLength(10).maxLength(2048),
})
