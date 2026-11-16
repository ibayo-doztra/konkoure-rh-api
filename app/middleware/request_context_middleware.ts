import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { newId } from '#shared/utils/crypto'

/**
 * Assigns a uuid v7 request id, returned in `X-Request-Id`, attached to every
 * log line and error body (docs/backend/01 §4, §10). Incoming ids are ignored:
 * a client must not be able to choose the id written to the audit trail.
 */
export default class RequestContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.requestId = newId()
    ctx.response.header('X-Request-Id', ctx.requestId)
    ctx.logger = ctx.logger.child({ requestId: ctx.requestId })
    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    requestId: string
  }
}
