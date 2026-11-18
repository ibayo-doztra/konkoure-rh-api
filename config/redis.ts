import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import type { InferConnections } from '@adonisjs/redis/types'

/**
 * Redis connections (docs/backend/11 §1). Each concern uses its own logical DB.
 */
const base = {
  host: env.get('REDIS_HOST'),
  port: env.get('REDIS_PORT'),
  password: env.get('REDIS_PASSWORD')?.release(),
  tls: env.get('REDIS_TLS', false) ? {} : undefined,
  // Never give up: a Redis outage must not require restarting the API.
  retryStrategy(times: number) {
    return Math.min(times * 200, 5000)
  },
}

const redisConfig = defineConfig({
  connection: 'limiter',

  connections: {
    cache: { ...base, db: env.get('REDIS_DB_CACHE', 0), keyPrefix: 'cache:' },
    limiter: { ...base, db: env.get('REDIS_DB_LIMITER', 2), keyPrefix: 'limiter:' },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
