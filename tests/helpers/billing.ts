import { createHmac } from 'node:crypto'
import djomyClient, { type Fetcher } from '#modules/billing/services/djomy_client'
import { jobs, type JobName } from '#shared/queue/jobs'
import queueService from '#shared/queue/queue_service'

export interface FakeDjomyCall {
  method: string
  path: string
  body: Record<string, unknown> | null
}

/**
 * Fake Djomy API (no network in tests): records the calls and answers the
 * transaction status from `transactions`, keyed by transaction id.
 */
export function fakeDjomy(
  options: {
    transactions?: Record<string, { status: string; paidAmount?: number; currency?: string }>
    failPayments?: boolean
  } = {}
) {
  const calls: FakeDjomyCall[] = []
  const transactions = options.transactions ?? {}
  let sequence = 0
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  const fetcher: Fetcher = async (url, init) => {
    const path = new URL(url).pathname
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
    calls.push({ method: init.method ?? 'GET', path, body })
    if (path === '/v1/auth') return json(200, { data: { accessToken: 'fake', expiresIn: 3600 } })
    if (path === '/v1/payments' || path === '/v1/payments/gateway') {
      if (options.failPayments) return json(500, { message: 'down' })
      sequence += 1
      const transactionId = `tx-${sequence}`
      transactions[transactionId] ??= { status: 'PENDING' }
      return json(201, {
        data: {
          transactionId,
          status: 'PENDING',
          ...(path.endsWith('gateway')
            ? { paymentUrl: `https://pay.djomy.test/${transactionId}` }
            : {}),
        },
      })
    }
    const status = path.match(/^\/v1\/payments\/([^/]+)\/status$/)
    if (status) {
      const transaction = transactions[decodeURIComponent(status[1])]
      if (!transaction) return json(404, { message: 'unknown' })
      return json(200, {
        data: {
          transactionId: status[1],
          status: transaction.status,
          paidAmount: transaction.paidAmount,
          currency: transaction.currency ?? 'GNF',
        },
      })
    }
    return json(404, {})
  }

  // Jobs are captured, then run by `drain()`: the sync driver would run them
  // after the response, racing the test's transaction.
  const dispatched: Array<{ name: JobName; payload: unknown }> = []
  const originalDispatch = queueService.dispatch
  queueService.dispatch = (async (name: JobName, payload: unknown) => {
    dispatched.push({ name, payload })
  }) as typeof queueService.dispatch

  const original = djomyClient.fetcher
  djomyClient.fetcher = fetcher
  return {
    calls,
    transactions,
    dispatched,
    /** Runs the captured jobs, and those they dispatch, in order. */
    async drain() {
      while (dispatched.length > 0) {
        const job = dispatched.shift()!
        await (jobs[job.name].handle as (payload: unknown) => Promise<unknown>)(job.payload)
      }
    },
    restore() {
      djomyClient.fetcher = original
      queueService.dispatch = originalDispatch
    },
  }
}

/** `X-Webhook-Signature` as Djomy computes it, with the test client secret (.env.test). */
export function djomySignature(rawBody: string, secret = 'test-djomy-secret') {
  return `v1:${createHmac('sha256', secret).update(rawBody).digest('hex')}`
}

export const DJOMY_PATH_TOKEN = 'test-djomy-path-token'
