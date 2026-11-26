import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'
import { platformClient } from '#shared/platform/platform_client'

/**
 * Prometheus metrics of the API process (docs/backend/01 §7, 09 §9), served by
 * the internal metrics server (`start/metrics.ts`). Counters are incremented
 * where the events happen; queue, pool and payment gauges are read at scrape
 * time. A failing source leaves its gauge unchanged and only logs.
 */
export const registry = new Registry()
registry.setDefaultLabels({ app: 'konkoure-api' })
collectDefaultMetrics({ register: registry, prefix: 'konkoure_' })

export const httpDuration = new Histogram({
  name: 'konkoure_http_request_duration_seconds',
  help: 'HTTP request duration by route pattern, method and status code',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5],
  registers: [registry],
})

export const cacheLookups = new Counter({
  name: 'konkoure_cache_lookups_total',
  help: 'Redis cache lookups by cache and result (hit, miss)',
  labelNames: ['cache', 'result'] as const,
  registers: [registry],
})

export const punches = new Counter({
  name: 'konkoure_timeclock_punches_total',
  help: 'Punches recorded, by source',
  labelNames: ['source'] as const,
  registers: [registry],
})

export const aiCalls = new Counter({
  name: 'konkoure_ai_calls_total',
  help: 'AI tasks run, by task and outcome (success, failure)',
  labelNames: ['task', 'outcome'] as const,
  registers: [registry],
})

export const aiCredits = new Counter({
  name: 'konkoure_ai_credits_consumed_total',
  help: 'AI credits consumed by successful tasks',
  registers: [registry],
})

export const webhookRejections = new Counter({
  name: 'konkoure_webhook_rejections_total',
  help: 'Inbound webhooks refused, by provider',
  labelNames: ['provider'] as const,
  registers: [registry],
})

/** Records one Redis cache lookup; `found` tells a hit from a miss. */
export function recordCacheLookup(cache: string, found: boolean) {
  cacheLookups.inc({ cache, result: found ? 'hit' : 'miss' })
}

/** Sources read at scrape time: registered once by the metrics server. */
export interface ScrapeSources {
  queues?: () => Promise<
    Array<{ queue: string; counts: Record<string, number>; oldestWaitingMs: number | null }>
  >
}

let sourcesRegistered = false

export function registerScrapeSources(sources: ScrapeSources) {
  if (sourcesRegistered) return
  sourcesRegistered = true

  new Gauge({
    name: 'konkoure_db_pool_connections',
    help: 'Database pool connections by connection and state (used, free, pending acquires)',
    labelNames: ['connection', 'state'] as const,
    registers: [registry],
    collect() {
      for (const name of ['pg', 'platform']) {
        const pool = db.manager.get(name)?.connection?.pool
        if (!pool) continue
        this.set({ connection: name, state: 'used' }, pool.numUsed())
        this.set({ connection: name, state: 'free' }, pool.numFree())
        this.set({ connection: name, state: 'pending' }, pool.numPendingAcquires())
      }
    },
  })

  if (sources.queues) {
    const read = sources.queues
    const depth = new Gauge({
      name: 'konkoure_queue_jobs',
      help: 'BullMQ jobs by queue and state (waiting, active, delayed, failed)',
      labelNames: ['queue', 'state'] as const,
      registers: [registry],
    })
    new Gauge({
      name: 'konkoure_queue_oldest_waiting_seconds',
      help: 'Age of the oldest waiting job, by queue (0 when none waits)',
      labelNames: ['queue'] as const,
      registers: [registry],
      async collect() {
        try {
          for (const { queue, counts, oldestWaitingMs } of await read()) {
            for (const [state, count] of Object.entries(counts)) {
              depth.set({ queue, state }, count)
            }
            this.set({ queue }, oldestWaitingMs === null ? 0 : oldestWaitingMs / 1000)
          }
        } catch (error) {
          logger.warn({ err: error }, 'metrics.queues_unavailable')
        }
      },
    })
  }

  new Gauge({
    name: 'konkoure_payments_pending',
    help: 'Payments not settled yet (pending, processing): count, and age in seconds of the oldest',
    labelNames: ['kind'] as const,
    registers: [registry],
    async collect() {
      try {
        // @platformScope — cross-organization count for monitoring only.
        const row = await platformClient()
          .from('payments')
          .whereIn('status', ['pending', 'processing'])
          .select(
            platformClient().raw('count(*)::int as total'),
            platformClient().raw(
              'coalesce(extract(epoch from now() - min(created_at)), 0)::float as oldest'
            )
          )
          .first()
        this.set({ kind: 'count' }, Number(row?.total ?? 0))
        this.set({ kind: 'oldest_seconds' }, Number(row?.oldest ?? 0))
      } catch (error) {
        logger.warn({ err: error }, 'metrics.payments_unavailable')
      }
    },
  })
}
