import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { AppException } from '#shared/exceptions/app_exception'
import { impersonationOf } from '#modules/auth/impersonation'

/**
 * Actions an impersonating admin may never take for the account (decision of
 * 2026-11-24): back office, password and profile, sessions, payments,
 * deletion of the organization. After `auth`.
 */
export default class NotImpersonatingMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (impersonationOf(ctx.auth.user)) {
      throw new AppException('E_FORBIDDEN', {
        details: [
          {
            field: 'authorization',
            rule: 'impersonation',
            message: 'validation.platform.impersonation',
          },
        ],
      })
    }
    return next()
  }
}
