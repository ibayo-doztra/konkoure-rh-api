import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import { AppException } from '#shared/exceptions/app_exception'
import scoringService from '#modules/recruitment/services/scoring_service'
import { n8nScoringQueryValidator } from '#modules/recruitment/validators/webhook_validator'

/** `POST /api/v1/webhooks/n8n/scoring` (06 §12, 05 §11, 08 §5). */
export default class N8nWebhookController {
  @ApiOperation({ summary: 'Scoring result from n8n (HMAC signed)' })
  async scoring(ctx: HttpContext) {
    const query = await n8nScoringQueryValidator.validate(ctx.request.qs())
    const outcome = await scoringService.receive({
      ...query,
      rawBody: ctx.request.raw() ?? '',
      signature: ctx.request.header('x-konkoure-signature'),
      timestamp: ctx.request.header('x-konkoure-timestamp'),
    })
    if (outcome === 'invalid_signature') throw new AppException('E_UNAUTHORIZED')
    // A replay is acknowledged without being processed again (06 §12).
    return ctx.serialize({ received: true, duplicate: outcome === 'duplicate' })
  }
}
