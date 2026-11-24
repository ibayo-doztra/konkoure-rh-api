import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import {
  jobs,
  SCHEDULES,
  SCHEDULE_TIMEZONE,
  type JobName,
  type JobPayload,
  type QueueName,
} from '#shared/queue/jobs'

export type QueueDriver = 'bullmq' | 'sync'

/**
 * Debounce (08 §3): while a job with the same `jobId` waits, BullMQ ignores the
 * new one. The id must not contain `:`. Such a job is removed once finished, so
 * the next occurrence can be enqueued. The `sync` driver ignores both options.
 */
export interface DispatchOptions {
  jobId?: string
  delay?: number
}

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

/**
 * Exponential backoff, 30 s base, capped at one hour (08 §1), unless the job
 * declares its own delays (`retry.delaysMs`).
 */
export function backoffDelay(attemptsMade: number, jobName?: string): number {
  const delays = jobName ? jobs[jobName as JobName]?.retry?.delaysMs : undefined
  if (delays && delays.length > 0) {
    return delays[Math.min(Math.max(attemptsMade - 1, 0), delays.length - 1)]
  }
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
    attempts: 'retry' in definition && definition.retry ? definition.retry.attempts : ATTEMPTS,
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

  async dispatch<Name extends JobName>(
    name: Name,
    payload: JobPayload<Name>,
    options: DispatchOptions = {}
  ): Promise<void> {
    if (this.driver === 'sync') {
      setImmediate(() => {
        this.run(name, payload).catch(async (error) => {
          logger.error({ err: error, job: name }, 'job.failed')
          await this.giveUp(name, payload, error)
        })
      })
      return
    }

    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Queue unavailable')), ENQUEUE_TIMEOUT_MS)
    })
    try {
      const opts: JobsOptions = { ...jobOptions(name), ...options }
      if (options.jobId) Object.assign(opts, { removeOnComplete: true, removeOnFail: true })
      const add = this.queue(jobs[name].queue).add(name, payload, opts)
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
        settings: {
          backoffStrategy: (attemptsMade, _type, _error, job) =>
            backoffDelay(attemptsMade, job?.name),
        },
      })
      worker.on('error', (error) => logger.error({ err: error, queue: name }, 'worker.error'))
      worker.on('failed', async (job, error) => {
        const terminal = job && job.attemptsMade >= (job.opts.attempts ?? 1)
        logger[terminal ? 'error' : 'warn'](
          { err: error, queue: name, job: job?.name, jobId: job?.id, attempts: job?.attemptsMade },
          terminal ? 'job.failed' : 'job.retry'
        )
        if (job && terminal) await this.giveUp(job.name as JobName, job.data, error)
      })
      return worker
    })
  }

  /**
   * Declares the recurring jobs of 08 §2 (idempotent: an existing scheduler is
   * updated in place). Called by the worker process; never with the sync driver.
   */
  async registerSchedules() {
    for (const { job, pattern } of SCHEDULES) {
      await this.queue(jobs[job].queue).upsertJobScheduler(
        job,
        { pattern, tz: SCHEDULE_TIMEZONE },
        { name: job, data: {}, opts: jobOptions(job) }
      )
    }
  }

  async close() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()))
    this.queues.clear()
  }

  /** The `failed` hook of a job whose last attempt failed; errors are only logged. */
  private async giveUp<Name extends JobName>(
    name: Name,
    payload: JobPayload<Name>,
    error: unknown
  ) {
    const hook = jobs[name]?.failed as
      ((data: JobPayload<Name>, error: unknown) => Promise<void>) | undefined
    if (!hook) return
    try {
      await hook(payload, error)
    } catch (hookError) {
      logger.error({ err: hookError, job: name }, 'job.failed_hook_error')
    }
  }

  private run<Name extends JobName>(name: Name, payload: JobPayload<Name>) {
    const definition = jobs[name]
    if (!definition) throw new Error(`Unknown job ${name}`)
    // `name` and `payload` are tied by JobPayload<Name>; TypeScript cannot narrow the union.
    const handle = definition.handle as (data: JobPayload<Name>) => Promise<unknown>
    return handle(payload)
  }
}

/** Without a worker in development, jobs run in-process unless configured otherwise. */
export const queueDriver: QueueDriver =
  env.get('QUEUE_DRIVER') ?? (app.inProduction ? 'bullmq' : 'sync')

export default new QueueService(queueDriver)
