import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PerformancePolicy from '#policies/performance_policy'
import reviewService from '#modules/performance/services/review_service'
import {
  reviewDto,
  reviewSummaryDto,
} from '#modules/performance/transformers/performance_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  idValidator,
  listReviewsValidator,
  managerReviewValidator,
  openReviewsValidator,
  selfReviewValidator,
  sendBackReviewValidator,
  talentReviewValidator,
} from '#modules/performance/validators/performance_validator'
import { auditContext } from '#modules/auth/http_helpers'

type View = Awaited<ReturnType<typeof reviewService.view>>

/** `/api/v1/org/performance/reviews` (06-api-reference §9, 07 §5.7). */
export default class ReviewsController {
  @ApiOperation({ summary: 'List the evaluations visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listReviewsValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const { rows, meta } = await reviewService.list(ctx.tenant, query)
    return { data: rows.map(reviewSummaryDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Open the evaluations of an open cycle' })
  @ApiBody({ type: () => openReviewsValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(openReviewsValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('openReviews')
    const result = await reviewService.open(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(result)
  }

  @ApiOperation({ summary: 'Evaluation detail with its goals' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { review, inTeam } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewReview', review, inTeam)
    return this.render(ctx, await reviewService.view(ctx.tenant, review))
  }

  @ApiOperation({ summary: 'Save the self-evaluation' })
  @ApiBody({ type: () => selfReviewValidator })
  async saveSelf(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(selfReviewValidator)
    const { review } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('selfReview', review)
    const view = await reviewService.saveSelf(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: 'Submit the self-evaluation to the manager' })
  async submitSelf(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { review } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('selfReview', review)
    const view = await reviewService.submitSelf(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: 'Save the manager evaluation' })
  @ApiBody({ type: () => managerReviewValidator })
  async saveManager(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(managerReviewValidator)
    const { review, inTeam } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageReview', review, inTeam)
    const view = await reviewService.saveManager(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: 'Validate a submitted evaluation' })
  async validate(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { review, inTeam } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageReview', review, inTeam)
    const view = await reviewService.validate(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: 'Send a submitted evaluation back (comment required)' })
  @ApiBody({ type: () => sendBackReviewValidator })
  async sendBack(ctx: HttpContext) {
    const { params, comment } = await ctx.request.validateUsing(sendBackReviewValidator)
    const { review, inTeam } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageReview', review, inTeam)
    const view = await reviewService.sendBack(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      comment,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: 'Sign a validated evaluation (evaluated employee)' })
  async sign(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { review } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('selfReview', review)
    const view = await reviewService.sign(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: '9-box scores of a validated or signed evaluation (HR)' })
  @ApiBody({ type: () => talentReviewValidator })
  async talent(ctx: HttpContext) {
    const { params, ...scores } = await ctx.request.validateUsing(talentReviewValidator)
    const { review } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('scoreTalent', review)
    const view = await reviewService.scoreTalent(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      scores,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  @ApiOperation({ summary: 'AI synthesis of an evaluation (one AI credit)' })
  async aiSummary(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { review, inTeam } = await reviewService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('manageReview', review, inTeam)
    const view = await reviewService.aiSummary(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return this.render(ctx, view)
  }

  private render(ctx: HttpContext, view: View) {
    const ownView = ctx.tenant.employeeId === view.review.employeeId
    return ctx.serialize(reviewDto(view, ownView))
  }
}
