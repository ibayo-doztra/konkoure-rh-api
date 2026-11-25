import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PlatformPolicy from '#policies/platform_policy'
import organizationService from '#modules/platform/services/platform_organization_service'
import {
  platformOrganizationDto,
  platformOrganizationRowDto,
} from '#modules/platform/transformers/platform_transformer'
import {
  idValidator,
  listOrganizationsValidator,
  updateSubscriptionValidator,
} from '#modules/platform/validators/platform_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/platform` dashboard and organizations (06 §13). */
export default class PlatformOrganizationsController {
  @ApiOperation({ summary: 'MRR, organizations, trials and churn' })
  async dashboard(ctx: HttpContext) {
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    return ctx.serialize(await organizationService.dashboard())
  }

  @ApiOperation({ summary: 'Organizations across the platform' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listOrganizationsValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const page = query.page ?? 1
    const perPage = query.perPage ?? 25
    const { total, rows } = await organizationService.list({
      page,
      perPage,
      q: query.q,
      status: query.filter?.status,
      planCode: query.filter?.plan,
    })
    return {
      data: rows.map(platformOrganizationRowDto),
      meta: {
        total,
        perPage,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
      },
    }
  }

  @ApiOperation({ summary: 'Organization detail, subscription, usage and owners' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    return ctx.serialize(platformOrganizationDto(await organizationService.detail(params.id)))
  }

  @ApiOperation({ summary: 'Change the subscription of an organization (root)' })
  @ApiBody({ type: () => updateSubscriptionValidator })
  async updateSubscription(ctx: HttpContext) {
    const { params, ...patch } = await ctx.request.validateUsing(updateSubscriptionValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const detail = await organizationService.updateSubscription(
      params.id,
      ctx.auth.getUserOrFail(),
      patch,
      auditContext(ctx)
    )
    return ctx.serialize(platformOrganizationDto(detail))
  }

  @ApiOperation({ summary: 'Suspend an organization (root)' })
  async suspend(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const detail = await organizationService.suspend(
      params.id,
      ctx.auth.getUserOrFail(),
      auditContext(ctx)
    )
    return ctx.serialize(platformOrganizationDto(detail))
  }

  @ApiOperation({ summary: 'Reactivate a suspended organization (root)' })
  async reactivate(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const detail = await organizationService.reactivate(
      params.id,
      ctx.auth.getUserOrFail(),
      auditContext(ctx)
    )
    return ctx.serialize(platformOrganizationDto(detail))
  }
}
