import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import demoRequestService from '#modules/platform/services/demo_request_service'
import { createDemoRequestValidator } from '#modules/platform/validators/platform_validator'

/** `POST /api/v1/public/demo-requests` (06 §11), unauthenticated, rate limited. */
export default class DemoRequestsController {
  @ApiOperation({ summary: 'Ask for a demo' })
  @ApiBody({ type: () => createDemoRequestValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createDemoRequestValidator)
    const request = await demoRequestService.create(input, ctx.request.ip() ?? null)
    ctx.response.status(201)
    return ctx.serialize({ id: request.id, received: true })
  }
}
