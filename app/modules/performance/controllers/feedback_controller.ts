import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PerformancePolicy from '#policies/performance_policy'
import { AppException } from '#shared/exceptions/app_exception'
import feedbackService from '#modules/performance/services/feedback_service'
import achievementService from '#modules/performance/services/achievement_service'
import {
  achievementDto,
  feedbackDto,
} from '#modules/performance/transformers/performance_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  createAchievementValidator,
  createFeedbackValidator,
  idValidator,
  listAchievementsValidator,
  listFeedbackValidator,
} from '#modules/performance/validators/performance_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/performance/feedback` and `/achievements` (06 §9, 07 §5.9). */
export default class FeedbackController {
  @ApiOperation({ summary: 'Feedback received, sent, or of the team when visible to managers' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listFeedbackValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const user = ctx.auth.getUserOrFail()
    const { rows, meta } = await feedbackService.list(ctx.tenant, user, query)
    const hr = ctx.tenant.hasRole('owner', 'hr_admin')
    return {
      data: rows.map((row) => feedbackDto(row, hr || row.createdBy === user.id)),
      meta: pageMetaDto(meta),
    }
  }

  @ApiOperation({ summary: 'Give feedback (kudos, suggestion or concern)' })
  @ApiBody({ type: () => createFeedbackValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createFeedbackValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const feedback = await feedbackService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(feedbackDto(feedback, true))
  }

  @ApiOperation({ summary: 'Delete feedback (author or O H, never the recipient)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const feedback = await feedbackService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('deleteFeedback', feedback)
    await feedbackService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Achievements visible to the caller' })
  async achievements(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listAchievementsValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const { rows, meta } = await achievementService.list(ctx.tenant, query)
    return { data: rows.map(achievementDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Record an achievement, for oneself or a team member' })
  @ApiBody({ type: () => createAchievementValidator })
  async storeAchievement(ctx: HttpContext) {
    const { employeeId, ...input } = await ctx.request.validateUsing(createAchievementValidator)
    const holder = employeeId ?? ctx.tenant.employeeId
    if (!holder) {
      throw AppException.validation('employeeId', 'required', 'validation.performance.holder')
    }
    const inTeam = await achievementService.inTeam(ctx.tenant, holder)
    await ctx.bouncer.with(PerformancePolicy).authorize('createAchievement', holder, inTeam)
    const achievement = await achievementService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      holder,
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(achievementDto(achievement))
  }

  @ApiOperation({ summary: 'Delete an achievement (author or O H)' })
  async destroyAchievement(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const achievement = await achievementService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('deleteAchievement', achievement)
    await achievementService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
