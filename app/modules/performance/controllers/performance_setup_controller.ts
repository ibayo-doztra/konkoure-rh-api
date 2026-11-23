import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PerformancePolicy from '#policies/performance_policy'
import cycleService from '#modules/performance/services/cycle_service'
import planService from '#modules/performance/services/plan_service'
import { cycleDto, planDto } from '#modules/performance/transformers/performance_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  createCycleValidator,
  createPlanValidator,
  idValidator,
  listCyclesValidator,
  listPlansValidator,
  updateCycleValidator,
  updatePlanValidator,
} from '#modules/performance/validators/performance_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/performance/cycles` and `/plans` (06-api-reference §9). */
export default class PerformanceSetupController {
  @ApiOperation({ summary: 'List the evaluation cycles' })
  async cycles(ctx: HttpContext) {
    const { filter, ...paging } = await ctx.request.validateUsing(listCyclesValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const page = await cycleService.list(ctx.tenant, {
      page: paging.page ?? 1,
      perPage: paging.perPage ?? 25,
      status: filter?.status,
    })
    return { data: page.all().map(cycleDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Create an evaluation cycle (draft)' })
  @ApiBody({ type: () => createCycleValidator })
  async storeCycle(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createCycleValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    const cycle = await cycleService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(cycleDto(cycle))
  }

  @ApiOperation({ summary: 'Update a cycle that is not closed' })
  @ApiBody({ type: () => updateCycleValidator })
  async updateCycle(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateCycleValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    const cycle = await cycleService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(cycleDto(cycle))
  }

  @ApiOperation({ summary: 'Open a draft cycle' })
  async openCycle(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    const cycle = await cycleService.open(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(cycleDto(cycle))
  }

  @ApiOperation({ summary: 'Close an open cycle' })
  async closeCycle(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    const cycle = await cycleService.close(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(cycleDto(cycle))
  }

  @ApiOperation({ summary: 'List the goal plans' })
  async plans(ctx: HttpContext) {
    const { filter, ...paging } = await ctx.request.validateUsing(listPlansValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const page = await planService.list(ctx.tenant, {
      page: paging.page ?? 1,
      perPage: paging.perPage ?? 25,
      status: filter?.status,
    })
    return { data: page.all().map(planDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Create a goal plan' })
  @ApiBody({ type: () => createPlanValidator })
  async storePlan(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createPlanValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    const plan = await planService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(planDto(plan))
  }

  @ApiOperation({ summary: 'Update a goal plan (activation checks the weights)' })
  @ApiBody({ type: () => updatePlanValidator })
  async updatePlan(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updatePlanValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    const plan = await planService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(planDto(plan))
  }

  @ApiOperation({ summary: 'Delete a goal plan (soft delete)' })
  async destroyPlan(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageSetup')
    await planService.remove(ctx.tenant, ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
