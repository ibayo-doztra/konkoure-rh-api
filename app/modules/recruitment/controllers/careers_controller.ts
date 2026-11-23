import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import careersService from '#modules/recruitment/services/careers_service'
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
}
