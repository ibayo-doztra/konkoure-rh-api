import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { errors as authErrors } from '@adonisjs/auth'
import { AppException } from '#shared/exceptions/app_exception'
import accessTokens from '#modules/auth/repositories/access_token_repository'

/**
 * Requires a valid access token (docs/backend/04 §1):
 * - expired token → 401 `E_TOKEN_EXPIRED`, the client refreshes once;
 * - missing/unknown token → 401 `E_UNAUTHORIZED`;
 * - deactivated or deleted account → 401, effective immediately (04 §3).
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    try {
      await ctx.auth.authenticateUsing(['api'])
    } catch (error) {
      if (!(error instanceof authErrors.E_UNAUTHORIZED_ACCESS)) throw error
      const bearer = ctx.request.header('authorization')?.replace(/^Bearer\s+/i, '')
      if (bearer && (await accessTokens.isExpired(bearer))) {
        throw new AppException('E_TOKEN_EXPIRED')
      }
      throw new AppException('E_UNAUTHORIZED')
    }

    if (!ctx.auth.getUserOrFail().canAuthenticate) throw new AppException('E_UNAUTHORIZED')
    return next()
  }
}
