import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PlatformPolicy from '#policies/platform_policy'
import planService from '#modules/platform/services/platform_plan_service'
import { platformPlanDto } from '#modules/platform/transformers/platform_transformer'
import {
  createPlanValidator,
  idValidator,
  updatePlanValidator,
} from '#modules/platform/validators/platform_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/platform/plans` (06 §13): support reads, root writes. */
export default class PlatformPlansController {
  @ApiOperation({ summary: 'Every plan, deleted ones included' })
  async index(ctx: HttpContext) {
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const plans = await planService.list()
    return { data: plans.map(platformPlanDto) }
  }

  @ApiOperation({ summary: 'Create a plan (root)' })
  @ApiBody({ type: () => createPlanValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createPlanValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const plan = await planService.create(ctx.auth.getUserOrFail(), input, auditContext(ctx))
    ctx.response.status(201)
    return ctx.serialize(platformPlanDto(plan))
  }

  @ApiOperation({ summary: 'Update a plan (root); the code never changes' })
  @ApiBody({ type: () => updatePlanValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updatePlanValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const plan = await planService.update(
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(platformPlanDto(plan))
  }

  @ApiOperation({ summary: 'Delete a plan no subscription uses (root)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    await planService.remove(ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
