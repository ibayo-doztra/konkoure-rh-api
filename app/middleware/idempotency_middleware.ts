import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import redis from '@adonisjs/redis/services/main'
import { AppException } from '#shared/exceptions/app_exception'
import { sha256 } from '#shared/utils/crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TTL_SECONDS = 24 * 60 * 60
const LOCK_SECONDS = 60

interface StoredResponse {
  status: number
  body: unknown
}

/**
 * `Idempotency-Key` on sensitive mutations (docs/backend/01 §8): the first
 * successful response is kept 24 h in Redis and replayed, with
 * `Idempotent-Replay: true`, for a repeated key. Keys are scoped to the user,
 * organization and route, so a key never replays someone else's response.
 * Without the header the request runs normally. Failed requests are not
 * stored: the client may retry them with the same key.
 */
export default class IdempotencyMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const key = ctx.request.header('idempotency-key')?.trim()
    if (!key) return next()
    if (!UUID.test(key)) {
      throw new AppException('E_BAD_REQUEST', {
        details: [
          { field: 'Idempotency-Key', rule: 'uuid', message: 'validation.idempotencyKey.uuid' },
        ],
      })
    }

    const scope = [
      ctx.auth.user?.id ?? 'anonymous',
      ctx.request.header('x-organization-id') ?? '-',
      ctx.request.method(),
      ctx.request.url(),
      key,
    ].join('|')
    const storeKey = `idempotency:${sha256(scope)}`
    const lockKey = `${storeKey}:lock`
    const store = redis.connection('cache')

    const replay = await store.get(storeKey)
    if (replay) return this.replay(ctx, JSON.parse(replay) as StoredResponse)

    const locked = await store.set(lockKey, '1', 'EX', LOCK_SECONDS, 'NX')
    if (!locked) throw new AppException('E_CONFLICT')

    try {
      await next()
      const status = ctx.response.getStatus()
      if (status >= 200 && status < 300) {
        const stored: StoredResponse = { status, body: ctx.response.getBody() ?? null }
        await store.set(storeKey, JSON.stringify(stored), 'EX', TTL_SECONDS)
      }
    } finally {
      await store.del(lockKey)
    }
  }

  private replay(ctx: HttpContext, stored: StoredResponse) {
    ctx.response.header('Idempotent-Replay', 'true')
    ctx.response.status(stored.status)
    if (stored.body === null) return ctx.response.send('')
    return ctx.response.send(stored.body)
  }
}
