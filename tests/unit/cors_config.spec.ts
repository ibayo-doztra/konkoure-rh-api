import { test } from '@japa/runner'
import corsConfig from '#config/cors'
import { GLOBAL_IP_PER_MINUTE } from '#start/limiter'

test.group('CORS and global rate limit', () => {
  test('a browser client can read the rate-limit headers', ({ assert }) => {
    const exposed = (corsConfig.exposeHeaders ?? []).map((header) => header.toLowerCase())
    assert.includeMembers(exposed, ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining'])
  })

  test('the global budget per IP stays 300 per minute by default', ({ assert }) => {
    assert.equal(GLOBAL_IP_PER_MINUTE, 300)
  })
})
