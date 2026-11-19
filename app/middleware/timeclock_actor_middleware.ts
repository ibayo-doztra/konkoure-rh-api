import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { AppException } from '#shared/exceptions/app_exception'
import { TenantContext } from '#shared/tenant/tenant_context'
import AuthMiddleware from '#middleware/auth_middleware'
import TenantMiddleware from '#middleware/tenant_middleware'
import deviceTokenService, {
  DEVICE_TOKEN_PREFIX,
} from '#modules/timeclock/services/device_token_service'

/**
 * Scan and offline sync (docs/backend/05 §6) accept either a kiosk token
 * (`kd_…`, ability `timeclock:scan` only, organization taken from the token)
 * or a member session, which goes through `auth` then `tenant` as usual.
 * Every other route keeps rejecting kiosk tokens.
 */
export default class TimeclockActorMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const bearer = ctx.request
      .header('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim()
    if (bearer?.startsWith(DEVICE_TOKEN_PREFIX)) {
      const device = await deviceTokenService.authenticate(bearer)
      if (!device) throw new AppException('E_UNAUTHORIZED')
      ctx.tenant = new TenantContext(device.organizationId, [], null)
      ctx.device = { id: device.id, name: device.name }
      return next()
    }
    return new AuthMiddleware().handle(ctx, () => new TenantMiddleware().handle(ctx, next))
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    /** Set when a kiosk token authenticated the request. */
    device?: { id: string; name: string }
  }
}
