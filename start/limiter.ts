/*
|--------------------------------------------------------------------------
| HTTP rate limits (docs/backend/05 §8)
|--------------------------------------------------------------------------
|
| Endpoint-specific budgets (login, refresh, forgot-password, verification
| e-mails) are enforced in the auth services, where the key is known.
|
*/

import limiter from '@adonisjs/limiter/services/main'

/** Global budget: 300 requests / minute / IP. */
export const throttleIp = limiter.define('global_ip', (ctx) =>
  limiter.allowRequests(300).every('1 minute').usingKey(`ip:${ctx.request.ip()}`)
)

/** Authenticated budget: 600 requests / minute / user. */
export const throttleUser = limiter.define('global_user', (ctx) =>
  limiter
    .allowRequests(600)
    .every('1 minute')
    .usingKey(`user:${ctx.auth.user?.id ?? ctx.request.ip()}`)
)
