import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import RecruitmentPolicy from '#policies/recruitment_policy'
import socialPostService from '#modules/integrations/services/social_post_service'
import { socialPostDto } from '#modules/integrations/transformers/social_transformer'
import {
  createSocialPostsValidator,
  jobSocialPostsValidator,
  suggestSocialPostValidator,
} from '#modules/integrations/validators/social_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** Publication of a job offer on social accounts (06 §8, decisions of 2026-11-26). */
export default class SocialPostsController {
  @ApiOperation({ summary: 'Publications of the offer and their state (O H R), newest first' })
  async index(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(jobSocialPostsValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageJobs')
    const posts = await socialPostService.list(ctx.tenant, params.id)
    return { data: posts.map(({ post, accountName }) => socialPostDto(post, accountName)) }
  }

  @ApiOperation({
    summary: 'Publish the offer on social accounts (O H R): 202, sent in background',
  })
  @ApiBody({ type: () => createSocialPostsValidator })
  async store(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(createSocialPostsValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageJobs')
    const posts = await socialPostService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.response.accepted({
      data: posts.map(({ post, accountName }) => socialPostDto(post, accountName)),
    })
  }

  @ApiOperation({ summary: 'AI text announcing the offer on a network (one AI credit)' })
  @ApiBody({ type: () => suggestSocialPostValidator })
  async suggest(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(suggestSocialPostValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageJobs')
    const result = await socialPostService.suggest(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input
    )
    return ctx.serialize(result)
  }
}
