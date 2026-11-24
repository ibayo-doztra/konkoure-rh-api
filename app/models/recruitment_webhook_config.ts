import { RecruitmentWebhookConfigSchema } from '#database/schema'

export type WebhookEnv = RecruitmentWebhookConfigSchema['activeEnv']

/**
 * n8n webhook settings of an organization (02 §7), keyed by the organization.
 * The secret is only ever stored encrypted. Never serialized directly.
 */
export default class RecruitmentWebhookConfig extends RecruitmentWebhookConfigSchema {
  static table = 'recruitment_webhook_configs'
  static selfAssignPrimaryKey = true
}
