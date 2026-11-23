import vine from '@vinejs/vine'

const url = () => vine.string().trim().maxLength(2000)

/** PUT /org/recruitment/webhooks: URLs checked against 05 §10 by the service. */
export const updateWebhookConfigValidator = vine.create({
  testWebhookUrl: url().nullable().optional(),
  prodWebhookUrl: url().nullable().optional(),
  activeEnv: vine.enum(['off', 'test', 'prod'] as const).optional(),
  rotateSecret: vine.boolean().optional(),
})

export const pingWebhookValidator = vine.create({
  env: vine.enum(['test', 'prod'] as const).optional(),
})

/** POST /webhooks/n8n/scoring: the target comes from the callback URL we sent. */
export const n8nScoringQueryValidator = vine.create({
  organizationId: vine.string().uuid(),
  candidateId: vine.string().uuid(),
})
