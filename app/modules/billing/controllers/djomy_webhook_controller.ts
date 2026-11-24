import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import { AppException } from '#shared/exceptions/app_exception'
import settlementService from '#modules/billing/services/settlement_service'

/**
 * `POST /api/v1/webhooks/djomy/:token` (06 §12, decision of 2026-11-24): secret
 * path segment and `X-Webhook-Signature`, journaled once, settled in the queue
 * after a server-side check with Djomy.
 */
export default class DjomyWebhookController {
  @ApiOperation({ summary: 'Djomy payment event (signed)' })
  async handle(ctx: HttpContext) {
    const outcome = await settlementService.receive({
      token: ctx.request.param('token'),
      rawBody: ctx.request.raw() ?? '',
      signature: ctx.request.header('x-webhook-signature'),
    })
    if (outcome === 'invalid_signature') throw new AppException('E_UNAUTHORIZED')
    return ctx.serialize({ received: true, duplicate: outcome === 'duplicate' })
  }
}
