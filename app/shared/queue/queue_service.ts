import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { jobs, type JobName, type JobPayload, type QueueName } from '#shared/queue/jobs'

export type QueueDriver = 'bullmq' | 'sync'

/** Queues, concurrency and priorities of docs/backend/08 §1. */
export const QUEUES: Record<QueueName, { concurrency: number; priority: number }> = {
  critical: { concurrency: 10, priority: 1 },
  default: { concurrency: 20, priority: 5 },
  ai: { concurrency: 4, priority: 5 },
  outbound: { concurrency: 5, priority: 5 },
  maintenance: { concurrency: 2, priority: 9 },
}

const ATTEMPTS = 5
const BACKOFF_BASE_MS = 30_000
const BACKOFF_MAX_MS = 60 * 60 * 1000
/** A Redis outage must not hold an HTTP request: the caller gets an error instead. */
const ENQUEUE_TIMEOUT_MS = 2000

/** Exponential backoff, 30 s base, capped at one hour (08 §1). */
export function backoffDelay(attemptsMade: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(attemptsMade - 1, 0), BACKOFF_MAX_MS)
}

function connection(extra: Record<string, unknown>): ConnectionOptions {
  return {
    host: env.get('REDIS_HOST'),
    port: env.get('REDIS_PORT'),
    password: env.get('REDIS_PASSWORD')?.release(),
    tls: env.get('REDIS_TLS', false) ? {} : undefined,
    db: env.get('REDIS_DB_QUEUE', 1),
    ...extra,
  }
}

export function jobOptions(name: JobName): JobsOptions {
  const definition = jobs[name]
  return {
    attempts: ATTEMPTS,
    backoff: { type: 'custom' },
    priority: QUEUES[definition.queue].priority,
    removeOnComplete: definition.sensitive ? true : 1000,
    removeOnFail: definition.sensitive ? true : 5000,
  }
}

/**
 * Background work (docs/backend/08 §1). Always called after the commit. The
 * `sync` driver runs the job in-process, for development and tests without a worker.
 */
export class QueueService {
  private queues = new Map<QueueName, Queue>()

  constructor(readonly driver: QueueDriver) {}

  async dispatch<Name extends JobName>(name: Name, payload: JobPayload<Name>): Promise<void> {
    if (this.driver === 'sync') {
      setImmediate(() => {
        this.run(name, payload).catch((error) =>
          logger.error({ err: error, job: name }, 'job.failed')
        )
      })
      return
    }

    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Queue unavailable')), ENQUEUE_TIMEOUT_MS)
    })
    try {
      const add = this.queue(jobs[name].queue).add(name, payload, jobOptions(name))
      await Promise.race([add, timeout])
    } finally {
      clearTimeout(timer)
    }
  }

  queue(name: QueueName): Queue {
    let queue = this.queues.get(name)
    if (!queue) {
      queue = new Queue(name, {
        connection: connection({ enableOfflineQueue: false, maxRetriesPerRequest: 1 }),
      })
      queue.on('error', (error) => logger.error({ err: error, queue: name }, 'queue.error'))
      this.queues.set(name, queue)
    }
    return queue
  }

  /** Worker process (`node ace queue:work`). */
  startWorkers(names: QueueName[] = Object.keys(QUEUES) as QueueName[]): Worker[] {
    return names.map((name) => {
      const worker = new Worker(name, (job) => this.run(job.name as JobName, job.data), {
        connection: connection({ maxRetriesPerRequest: null }),
        concurrency: QUEUES[name].concurrency,
        settings: { backoffStrategy: backoffDelay },
      })
      worker.on('error', (error) => logger.error({ err: error, queue: name }, 'worker.error'))
      worker.on('failed', (job, error) => {
        const terminal = job && job.attemptsMade >= (job.opts.attempts ?? 1)
        logger[terminal ? 'error' : 'warn'](
          { err: error, queue: name, job: job?.name, jobId: job?.id, attempts: job?.attemptsMade },
          terminal ? 'job.failed' : 'job.retry'
        )
      })
      return worker
    })
  }

  async close() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()))
    this.queues.clear()
  }

  private run<Name extends JobName>(name: Name, payload: JobPayload<Name>) {
    const definition = jobs[name]
    if (!definition) throw new Error(`Unknown job ${name}`)
    return definition.handle(payload)
  }
}

/** Without a worker in development, jobs run in-process unless configured otherwise. */
export const queueDriver: QueueDriver =
  env.get('QUEUE_DRIVER') ?? (app.inProduction ? 'bullmq' : 'sync')

export default new QueueService(queueDriver)
