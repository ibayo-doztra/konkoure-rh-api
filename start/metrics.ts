/*
|--------------------------------------------------------------------------
| Prometheus metrics server (docs/backend/01 §7, 09 §9)
|--------------------------------------------------------------------------
|
| Decision of 2026-11-26: a second HTTP server on METRICS_PORT (default 9464),
| bound to METRICS_HOST (default 127.0.0.1), serving only `GET /metrics`. It is
| never published by the reverse proxy and has no authentication: the network
| is the boundary. Off unless METRICS_ENABLED=true; web process only.
|
*/

import { createServer, type Server } from 'node:http'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import queueService, { queueDriver } from '#shared/queue/queue_service'
import { registerScrapeSources, registry } from '#shared/metrics/metrics'

export function startMetricsServer(port: number, host: string): Promise<Server> {
  registerScrapeSources({
    queues: queueDriver === 'bullmq' ? () => queueService.stats() : undefined,
  })
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url?.split('?')[0] !== '/metrics') {
      response.writeHead(404).end()
      return
    }
    try {
      const body = await registry.metrics()
      response.writeHead(200, { 'Content-Type': registry.contentType }).end(body)
    } catch (error) {
      logger.error({ err: error }, 'metrics.scrape_failed')
      response.writeHead(500).end()
    }
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      logger.info({ host, port }, 'metrics.listening')
      resolve(server)
    })
  })
}

if (env.get('METRICS_ENABLED', false)) {
  try {
    const server = await startMetricsServer(
      env.get('METRICS_PORT', 9464),
      env.get('METRICS_HOST', '127.0.0.1')
    )
    app.terminating(() => new Promise<void>((resolve) => server.close(() => resolve())))
  } catch (error) {
    // Monitoring never takes the API down (e.g. the port is taken): logged only.
    logger.error({ err: error }, 'metrics.listen_failed')
  }
}
