import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PerformancePolicy from '#policies/performance_policy'
import { AppException } from '#shared/exceptions/app_exception'
import goalService from '#modules/performance/services/goal_service'
import { goalActivityDto, goalDto } from '#modules/performance/transformers/performance_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  activityIdValidator,
  createActivityValidator,
  listActivitiesValidator,
  updateActivityValidator,
  createGoalValidator,
  goalProgressValidator,
  idValidator,
  listGoalsValidator,
  updateGoalValidator,
} from '#modules/performance/validators/performance_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/performance/goals` (06-api-reference §9, 07 §5.2). */
export default class GoalsController {
  @ApiOperation({ summary: 'List the goals visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listGoalsValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const { rows, meta } = await goalService.list(ctx.tenant, query)
    return { data: rows.map(goalDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Create a goal, for oneself or a team member' })
  @ApiBody({ type: () => createGoalValidator })
  async store(ctx: HttpContext) {
    const { employeeId, ...input } = await ctx.request.validateUsing(createGoalValidator)
    const holder = employeeId ?? ctx.tenant.employeeId
    if (!holder) {
      throw AppException.validation('employeeId', 'required', 'validation.performance.holder')
    }
    const inTeam = await goalService.inTeam(ctx.tenant, holder)
    await ctx.bouncer
      .with(PerformancePolicy)
      .authorize('createGoal', holder, inTeam, Boolean(input.ownerId))
    const goal = await goalService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      holder,
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(goalDto(goal))
  }

  @ApiOperation({ summary: 'Goal detail' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewGoal', goal, inTeam)
    return ctx.serialize(goalDto(goal))
  }

  @ApiOperation({ summary: 'Update a goal' })
  @ApiBody({ type: () => updateGoalValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateGoalValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer
      .with(PerformancePolicy)
      .authorize('updateGoal', goal, inTeam, input.ownerId !== undefined)
    const updated = await goalService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(goalDto(updated))
  }

  @ApiOperation({ summary: 'Update the progress of a goal (100 % achieves it)' })
  @ApiBody({ type: () => goalProgressValidator })
  async progress(ctx: HttpContext) {
    const { params, progress } = await ctx.request.validateUsing(goalProgressValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('progressGoal', goal, inTeam)
    const updated = await goalService.progress(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      progress,
      auditContext(ctx)
    )
    return ctx.serialize(goalDto(updated))
  }

  @ApiOperation({ summary: 'Delete a goal (soft delete)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewGoal', goal, inTeam)
    await goalService.remove(ctx.tenant, ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Activities of a goal' })
  async activities(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewGoal', goal, inTeam)
    const rows = await goalService.activities(ctx.tenant, goal.id)
    return { data: rows.map(goalActivityDto) }
  }

  @ApiOperation({ summary: 'Add an activity to a goal' })
  @ApiBody({ type: () => createActivityValidator })
  async storeActivity(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(createActivityValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewGoal', goal, inTeam)
    const activity = await goalService.addActivity(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      goal.id,
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(goalActivityDto(activity))
  }

  @ApiOperation({ summary: 'Activities across the goals visible to the caller' })
  async allActivities(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listActivitiesValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const { rows, meta } = await goalService.listActivities(ctx.tenant, query)
    return { data: rows.map(goalActivityDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Update an activity of a goal' })
  @ApiBody({ type: () => updateActivityValidator })
  async updateActivity(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateActivityValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewGoal', goal, inTeam)
    const activity = await goalService.updateActivity(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      goal.id,
      params.activityId,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(goalActivityDto(activity))
  }

  @ApiOperation({ summary: 'Delete an activity of a goal' })
  async destroyActivity(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(activityIdValidator)
    const { goal, inTeam } = await goalService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewGoal', goal, inTeam)
    await goalService.removeActivity(ctx.tenant, goal.id, params.activityId, auditContext(ctx))
    return ctx.response.noContent()
  }
}
