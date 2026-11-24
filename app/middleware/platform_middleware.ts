import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type PlatformAdmin from '#models/platform_admin'
import { AppException } from '#shared/exceptions/app_exception'
import platformAdmins from '#modules/users/repositories/platform_admin_repository'

/**
 * Gate of `/platform/*` (docs/backend/04 §4, §6), after `auth`: the caller must
 * be an active platform admin; `support` or `root` is then checked by
 * `PlatformPolicy`. No e-mail fallback (04 §4).
 */
export default class PlatformMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const admin = await platformAdmins.activeOf(user.id)
    if (!admin) throw new AppException('E_FORBIDDEN')
    ctx.platformAdmin = admin
    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    platformAdmin: PlatformAdmin
  }
}
