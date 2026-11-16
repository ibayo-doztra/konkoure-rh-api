import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'
import type { InferLimiters } from '@adonisjs/limiter/types'

/**
 * Redis store in every running environment; `memory` only for the test suite
 * (it is not shared between replicas).
 */
const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    redis: stores.redis({ connectionName: 'limiter' }),
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
