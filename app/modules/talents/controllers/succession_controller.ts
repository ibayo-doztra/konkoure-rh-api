import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import TalentPolicy from '#policies/talent_policy'
import successionService from '#modules/talents/services/succession_service'
import { successionPlanDto } from '#modules/talents/transformers/talent_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  createSuccessionValidator,
  listSuccessionValidator,
  successionIdValidator,
  updateSuccessionValidator,
} from '#modules/talents/validators/talent_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/talents/succession` (06 §10), owner and hr_admin. */
export default class SuccessionController {
  @ApiOperation({ summary: 'List succession plans' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listSuccessionValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('manage')
    const { page, names } = await successionService.list(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      readiness: query.filter?.readiness,
      employeeId: query.filter?.employeeId,
    })
    return {
      data: page.all().map((plan) => successionPlanDto(plan, names)),
      meta: pageMetaDto(page.getMeta()),
    }
  }

  @ApiOperation({ summary: 'Create a succession plan' })
  @ApiBody({ type: () => createSuccessionValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createSuccessionValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('manage')
    const { plan, names } = await successionService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(successionPlanDto(plan, names))
  }

  @ApiOperation({ summary: 'Update a succession plan' })
  @ApiBody({ type: () => updateSuccessionValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateSuccessionValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('manage')
    const { plan, names } = await successionService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(successionPlanDto(plan, names))
  }

  @ApiOperation({ summary: 'Delete a succession plan' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(successionIdValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('manage')
    await successionService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
