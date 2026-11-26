import { test } from '@japa/runner'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { startMetricsServer } from '#start/metrics'
import { expectStatus } from '#tests/helpers/http'
import { createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { setTimeclockSettings } from '#tests/helpers/timeclock'

let server: Server
let base: string

async function scrape(path = '/metrics') {
  const response = await fetch(`${base}${path}`)
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    body: await response.text(),
  }
}

/** Sample lines of `name` carrying all `labels`, whatever their order. */
function rows(body: string, name: string, labels: Record<string, string>) {
  const pairs = Object.entries(labels).map(([key, value]) => `${key}="${value}"`)
  return body
    .split('\n')
    .filter((row) => row.startsWith(`${name}{`) && pairs.every((pair) => row.includes(pair)))
}

/** Value of the first matching sample, 0 when absent. */
function sample(body: string, name: string, labels: Record<string, string> = {}) {
  const found = rows(body, name, labels)[0]
  return found ? Number(found.split(' ').at(-1)) : 0
}

test.group('metrics server (09 §9)', (group) => {
  group.setup(async () => {
    server = await startMetricsServer(0, '127.0.0.1')
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    return () => new Promise<void>((resolve) => server.close(() => resolve()))
  })
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('serves the Prometheus format on /metrics only', async ({ assert }) => {
    const metrics = await scrape()
    assert.equal(metrics.status, 200)
    assert.include(metrics.type, 'text/plain')
    assert.include(metrics.body, 'konkoure_process_cpu_seconds_total')
    assert.lengthOf(rows(metrics.body, 'konkoure_db_pool_connections', { state: 'used' }), 1)
    assert.lengthOf(rows(metrics.body, 'konkoure_payments_pending', { kind: 'count' }), 1)
    const other = await scrape('/other')
    assert.equal(other.status, 404)
  })

  test('records request durations by route pattern and final status', async ({
    client,
    assert,
  }) => {
    await expectStatus(client.get('/health'), 200)
    await expectStatus(client.get('/api/v1/nowhere-at-all'), 404)
    const { body } = await scrape()
    const name = 'konkoure_http_request_duration_seconds_count'
    assert.isAbove(sample(body, name, { route: '/health', status_code: '200' }), 0)
    assert.isAbove(sample(body, name, { route: 'unmatched', status_code: '404' }), 0)
    assert.notInclude(body, 'nowhere-at-all')
  })

  test('counts punches by source and cache lookups', async ({ client, assert }) => {
    const name = 'konkoure_timeclock_punches_total'
    const before = await scrape()
    const org = await createHrOrganization()
    await setTimeclockSettings(org, { requireZone: false })
    const me = await hrSession(client, org, ['employee'])
    await expectStatus(
      orgCall(client, 'POST', '/timeclock/punch', me, org).json({
        punchedAt: DateTime.now().minus({ seconds: 1 }).toISO(),
      }),
      201
    )
    const after = await scrape()
    assert.equal(
      sample(after.body, name, { source: 'manual' }),
      sample(before.body, name, { source: 'manual' }) + 1
    )
    assert.isNotEmpty(rows(after.body, 'konkoure_cache_lookups_total', { cache: 'entitlements' }))
  })
})
