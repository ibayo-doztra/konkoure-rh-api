import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import careersService from '#modules/recruitment/services/careers_service'
import applicationService from '#modules/recruitment/services/application_service'
import {
  applyCheckValidator,
  applyValidator,
} from '#modules/recruitment/validators/candidate_validator'
import {
  careersJobValidator,
  careersPageValidator,
} from '#modules/recruitment/validators/job_validator'

/** `/api/v1/public/careers` (06-api-reference §11), unauthenticated. */
export default class CareersController {
  @ApiOperation({ summary: 'Organization and its open job offers' })
  async page(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(careersPageValidator)
    return ctx.serialize(await careersService.page(params.orgSlug))
  }

  @ApiOperation({ summary: 'Detail of an open job offer' })
  async job(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(careersJobValidator)
    return ctx.serialize(await careersService.job(params.orgSlug, params.jobSlug))
  }

  @ApiOperation({ summary: 'Check that no application exists for this e-mail or phone' })
  async check(ctx: HttpContext) {
    const { params, email, phone } = await ctx.request.validateUsing(applyCheckValidator)
    await applicationService.check(params.orgSlug, params.jobSlug, email, phone)
    return ctx.serialize({ available: true })
  }

  @ApiOperation({ summary: 'Apply to an open offer (multipart)' })
  async apply(ctx: HttpContext) {
    // `website` is the honeypot: the validator already refused it when filled.
    const { params, fullName, email, phone, cv, coverLetter, documents } =
      await ctx.request.validateUsing(applyValidator)
    const candidate = await applicationService.apply(
      params.orgSlug,
      params.jobSlug,
      { fullName, email, phone, cv, coverLetter, documents },
      ctx.request.ip()
    )
    ctx.response.status(201)
    return ctx.serialize({
      candidateId: candidate.id,
      message: ctx.i18n.t('recruitment.applicationReceived'),
    })
  }
}
