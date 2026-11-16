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
  retryStrategy(times: number) {
    return times > 10 ? null : times * 50
  },
}

const redisConfig = defineConfig({
  connection: 'limiter',

  connections: {
    limiter: { ...base, db: env.get('REDIS_DB_LIMITER', 2), keyPrefix: 'limiter:' },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
