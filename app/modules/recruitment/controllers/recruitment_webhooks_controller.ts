import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import RecruitmentPolicy from '#policies/recruitment_policy'
import type RecruitmentWebhookConfig from '#models/recruitment_webhook_config'
import webhookConfigService from '#modules/recruitment/services/webhook_config_service'
import {
  pingWebhookValidator,
  updateWebhookConfigValidator,
} from '#modules/recruitment/validators/webhook_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** The secret itself is never read back, only whether one exists. */
function configDto(config: RecruitmentWebhookConfig | null) {
  return {
    testWebhookUrl: config?.testWebhookUrl ?? null,
    prodWebhookUrl: config?.prodWebhookUrl ?? null,
    activeEnv: config?.activeEnv ?? 'off',
    hasSecret: Boolean(config?.secretEncrypted),
    updatedAt: config?.updatedAt.toUTC().toISO() ?? null,
  }
}

/** `/api/v1/org/recruitment/webhooks` (06 §8, 08 §5): owner and hr_admin. */
export default class RecruitmentWebhooksController {
  @ApiOperation({ summary: 'n8n scoring webhook settings' })
  async show(ctx: HttpContext) {
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageWebhooks')
    return ctx.serialize(configDto(await webhookConfigService.show(ctx.tenant)))
  }

  @ApiOperation({ summary: 'Update the webhook; the secret is shown once when created or rotated' })
  @ApiBody({ type: () => updateWebhookConfigValidator })
  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(updateWebhookConfigValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageWebhooks')
    const { config, secret } = await webhookConfigService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    return ctx.serialize({ ...configDto(config), ...(secret ? { secret } : {}) })
  }

  @ApiOperation({ summary: 'Send a signed webhook.ping and return the diagnosis' })
  @ApiBody({ type: () => pingWebhookValidator })
  async ping(ctx: HttpContext) {
    const { env } = await ctx.request.validateUsing(pingWebhookValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageWebhooks')
    return ctx.serialize(await webhookConfigService.ping(ctx.tenant, env))
  }
}
