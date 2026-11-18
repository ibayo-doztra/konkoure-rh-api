import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import entitlementService, { type ModuleKey } from '#modules/billing/services/entitlement_service'

/**
 * Server-side module gate (docs/backend/07 §6.4), after `tenant`:
 * `.use(middleware.entitlement({ module: 'recruitment' }))`.
 */
export default class EntitlementMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { module: ModuleKey }) {
    const readOnlyRequest = ['GET', 'HEAD'].includes(ctx.request.method())
    await entitlementService.assertAccess(
      ctx.tenant.organizationId,
      options.module,
      readOnlyRequest
    )
    return next()
  }
}
