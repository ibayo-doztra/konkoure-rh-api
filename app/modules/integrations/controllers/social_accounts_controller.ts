import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import IntegrationPolicy from '#policies/integration_policy'
import socialAccountService from '#modules/integrations/services/social_account_service'
import {
  socialAccountDto,
  socialAccountSummaryDto,
} from '#modules/integrations/transformers/social_transformer'
import {
  connectSocialAccountValidator,
  socialAccountIdValidator,
  socialCallbackValidator,
} from '#modules/integrations/validators/social_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** Social accounts of the organization (06 §8, decisions of 2026-11-26). */
export default class SocialAccountsController {
  @ApiOperation({
    summary: 'Connected social accounts: full view for O H, reduced view for R; never tokens',
  })
  async index(ctx: HttpContext) {
    await ctx.bouncer.with(IntegrationPolicy).authorize('listSocialAccounts')
    const accounts = await socialAccountService.list(ctx.tenant)
    const full = ctx.tenant.hasRole('owner', 'hr_admin')
    return { data: accounts.map(full ? socialAccountDto : socialAccountSummaryDto) }
  }

  @ApiOperation({ summary: 'Start connecting a LinkedIn or Facebook page (O H): consent URL' })
  @ApiBody({ type: () => connectSocialAccountValidator })
  async store(ctx: HttpContext) {
    const { provider } = await ctx.request.validateUsing(connectSocialAccountValidator)
    await ctx.bouncer.with(IntegrationPolicy).authorize('manageSocialAccounts')
    const result = await socialAccountService.start(ctx.tenant, ctx.auth.getUserOrFail(), provider)
    return ctx.serialize(result)
  }

  @ApiOperation({ summary: 'Disconnect a social account (O H)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(socialAccountIdValidator)
    await ctx.bouncer.with(IntegrationPolicy).authorize('manageSocialAccounts')
    await socialAccountService.remove(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.response.noContent()
  }

  /** Public: the provider sends the member back here; always redirects to the front. */
  @ApiOperation({ summary: 'OAuth callback of a social network (public), redirects to the app' })
  async callback(ctx: HttpContext) {
    const { params, ...query } = await ctx.request.validateUsing(socialCallbackValidator)
    const url = await socialAccountService.callback(params.provider, query, auditContext(ctx))
    // The provider's `code` and `state` must not follow the member to the front.
    return ctx.response.redirect().withQs(false).toPath(url)
  }
}
