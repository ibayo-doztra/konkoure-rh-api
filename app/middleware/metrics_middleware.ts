import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { httpDuration } from '#shared/metrics/metrics'

/**
 * Request duration by route pattern (09 §9). The sample is taken when the
 * response is sent, so the status is the final one, error handler included.
 * The route pattern, never the URL, keeps the label set bounded.
 */
export default class MetricsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const end = httpDuration.startTimer()
    ctx.response.response.once('finish', () => {
      end({
        method: ctx.request.method(),
        route: ctx.route?.pattern ?? 'unmatched',
        status_code: String(ctx.response.response.statusCode),
      })
    })
    return next()
  }
}
