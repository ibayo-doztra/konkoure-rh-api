/*
|--------------------------------------------------------------------------
| HTTP rate limits (docs/backend/05 §8)
|--------------------------------------------------------------------------
|
| Endpoint-specific budgets (login, refresh, forgot-password, verification
| e-mails) are enforced in the auth services, where the key is known.
|
*/

import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'

/**
 * Global budget per IP: 300 requests / minute. End-to-end suites send every
 * request from one IP and may raise it with RATE_LIMIT_GLOBAL_IP_PER_MINUTE,
 * which production refuses so the protection cannot be loosened by mistake.
 */
const DEFAULT_GLOBAL_IP_PER_MINUTE = 300
const globalIpOverride = env.get('RATE_LIMIT_GLOBAL_IP_PER_MINUTE')
if (globalIpOverride !== undefined) {
  if (app.inProduction) {
    throw new Error('RATE_LIMIT_GLOBAL_IP_PER_MINUTE is for test environments only')
  }
  if (!Number.isInteger(globalIpOverride) || globalIpOverride < 1) {
    throw new Error('RATE_LIMIT_GLOBAL_IP_PER_MINUTE must be a positive integer')
  }
}
export const GLOBAL_IP_PER_MINUTE = globalIpOverride ?? DEFAULT_GLOBAL_IP_PER_MINUTE

export const throttleIp = limiter.define('global_ip', (ctx) =>
  limiter.allowRequests(GLOBAL_IP_PER_MINUTE).every('1 minute').usingKey(`ip:${ctx.request.ip()}`)
)

/** Authenticated budget: 600 requests / minute / user. */
export const throttleUser = limiter.define('global_user', (ctx) =>
  limiter
    .allowRequests(600)
    .every('1 minute')
    .usingKey(`user:${ctx.auth.user?.id ?? ctx.request.ip()}`)
)
