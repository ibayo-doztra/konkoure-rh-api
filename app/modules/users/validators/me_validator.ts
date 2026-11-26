import vine from '@vinejs/vine'

/** PATCH /me — fullName, avatarUrl, preferredLanguage (06-api-reference §2). */
export const updateMeValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(120).optional(),
  avatarUrl: vine
    .string()
    .trim()
    .maxLength(2048)
    .url({ protocols: ['https'] })
    .nullable()
    .optional(),
  preferredLanguage: vine.enum(['fr', 'en'] as const).optional(),
})

/** POST /me/password — the current password is required (04 §2). */
export const changePasswordValidator = vine.create({
  currentPassword: vine.string().minLength(1).maxLength(128),
  password: vine.string().minLength(10).maxLength(128).confirmed(),
})

export const sessionIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid() }),
})

/** DELETE /me — the password confirms the deletion (05 §13). */
export const deleteMeValidator = vine.create({
  password: vine.string().minLength(1).maxLength(128),
})
