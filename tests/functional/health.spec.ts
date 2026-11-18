import { test } from '@japa/runner'
import { expectStatus } from '#tests/helpers/http'

test.group('Health probes (docs/backend/06 §14)', () => {
  test('liveness reports the status, version and uptime', async ({ client, assert }) => {
    const response = await expectStatus(client.get('/health'), 200)
    const body = response.body()
    assert.equal(body.status, 'ok')
    assert.isString(body.version)
    assert.isNumber(body.uptime)
  })

  test('readiness checks PostgreSQL, Redis and migrations', async ({ client, assert }) => {
    const response = await expectStatus(client.get('/health/ready'), 200)
    assert.deepEqual(response.body(), {
      status: 'ok',
      checks: { database: 'ok', redis: 'ok', migrations: 'ok' },
    })
  })
})
