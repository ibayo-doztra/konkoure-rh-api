import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import RecruitmentWebhookConfig from '#models/recruitment_webhook_config'

/** The single webhook configuration row of an organization (02 §7). */
export class WebhookConfigRepository {
  constructor(
    readonly organizationId: string,
    private readonly trx: TransactionClientContract
  ) {
    if (!organizationId) throw new Error('A tenant repository requires an organization id')
  }

  find() {
    return RecruitmentWebhookConfig.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .first()
  }

  findForUpdate() {
    return RecruitmentWebhookConfig.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .forUpdate()
      .first()
  }

  async findOrNew() {
    const existing = await this.findForUpdate()
    if (existing) return existing
    const config = new RecruitmentWebhookConfig()
    config.organizationId = this.organizationId
    config.activeEnv = 'off'
    return config
  }

  save(config: RecruitmentWebhookConfig) {
    config.useTransaction(this.trx)
    return config.save()
  }
}

export function webhookConfigIn(organizationId: string, trx: TransactionClientContract) {
  return new WebhookConfigRepository(organizationId, trx)
}
