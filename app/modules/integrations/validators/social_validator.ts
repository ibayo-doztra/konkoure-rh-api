import vine from '@vinejs/vine'

const params = () => vine.object({ id: vine.string().uuid() })
/** Wired networks (decision of 2026-11-26); `twitter` stays in the enum only. */
const provider = () => vine.enum(['linkedin', 'facebook'] as const)

export const socialAccountIdValidator = vine.create({ params: params() })

/** POST /org/integrations/social/accounts: starts the OAuth flow. */
export const connectSocialAccountValidator = vine.create({ provider: provider() })

/** GET /api/v1/oauth/social/:provider/callback, as the provider sends it back. */
export const socialCallbackValidator = vine.create({
  params: vine.object({ provider: provider() }),
  code: vine.string().maxLength(2048).optional(),
  state: vine.string().maxLength(256).optional(),
  error: vine.string().maxLength(256).optional(),
})

/** GET /org/recruitment/jobs/:id/social-posts. */
export const jobSocialPostsValidator = vine.create({ params: params() })

/** POST /org/recruitment/jobs/:id/social-posts. */
export const createSocialPostsValidator = vine.create({
  params: params(),
  accountIds: vine.array(vine.string().uuid()).minLength(1).maxLength(10),
  content: vine.string().trim().minLength(1).maxLength(3000),
})

/** POST /org/recruitment/jobs/:id/social-posts/suggest: AI text, nothing stored. */
export const suggestSocialPostValidator = vine.create({
  params: params(),
  provider: provider(),
  language: vine.enum(['fr', 'en'] as const).optional(),
})
