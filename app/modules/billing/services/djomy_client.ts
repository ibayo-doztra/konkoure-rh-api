import { createHmac, timingSafeEqual } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import type { PaymentMethod } from '#models/payment'
import { AppException } from '#shared/exceptions/app_exception'
import env from '#start/env'

const DEFAULT_BASE_URL = 'https://api.djomy.africa'
const TIMEOUT_MS = 15_000
const ATTEMPTS = 3

/** Status of a Djomy transaction, reduced to what the billing needs. */
export type DjomyStatus = 'succeeded' | 'failed' | 'pending'

export interface DjomyTransaction {
  status: DjomyStatus
  transactionId: string | null
  paidAmount: number | null
  currency: string | null
  raw: Record<string, unknown>
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

/** Payment method codes of the direct collection API (existing integration). */
const DIRECT_METHOD: Record<'orange_money' | 'mtn_momo', string> = {
  orange_money: 'OM',
  mtn_momo: 'MOMO',
}

export function normalizeStatus(raw: unknown): DjomyStatus {
  const status = String(raw ?? '').toUpperCase()
  if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'PAYMENT.SUCCESS'].includes(status)) {
    return 'succeeded'
  }
  if (
    [
      'FAILED',
      'ERROR',
      'EXPIRED',
      'CANCELLED',
      'CANCELED',
      'PAYMENT.FAILED',
      'PAYMENT.CANCELLED',
    ].includes(status)
  ) {
    return 'failed'
  }
  return 'pending'
}

/** `+224` followed by the 8 or 9 local digits, as Djomy expects. */
export function payerIdentifier(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  const local = digits.startsWith('224') ? digits.slice(3) : digits
  return `+224${local}`
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asNumber = (value: unknown) => {
  const number = Number(value)
  return value === null || value === undefined || !Number.isFinite(number) ? null : number
}

const asString = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null

/** The transaction fields of a Djomy body (`{ data: … }` or flat). */
export function readTransaction(body: unknown): DjomyTransaction {
  const raw = asRecord(body)
  const data = asRecord(raw.data ?? raw)
  return {
    status: normalizeStatus(data.status ?? raw.eventType ?? raw.event),
    transactionId: asString(data.transactionId ?? data.id),
    paidAmount: asNumber(data.paidAmount ?? data.amount),
    currency: asString(data.currency),
    raw,
  }
}

/**
 * Djomy API client (decision of 2026-11-24, ported from the existing
 * integration): `X-API-KEY = clientId:HMAC(clientId, clientSecret)`, bearer
 * token from `POST /v1/auth`, 15 s timeout, 3 attempts on 429 and 5xx.
 * `fetcher` is replaced by a fake in tests: no network call there.
 */
export class DjomyClient {
  fetcher: Fetcher = (url, init) => fetch(url, init)
  private token: { value: string; expiresAt: number } | null = null

  get configured() {
    return Boolean(env.get('DJOMY_CLIENT_ID') && env.get('DJOMY_CLIENT_SECRET'))
  }

  /** `X-Webhook-Signature: v1:<hex HMAC-SHA256 of the raw body with the client secret>`. */
  verifyWebhook(rawBody: string, header: string | undefined) {
    const secret = env.get('DJOMY_CLIENT_SECRET')?.release()
    if (!secret || !header) return false
    const received = header.includes(':') ? header.split(':').slice(1).join(':') : header
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    return safeEqual(received.trim().toLowerCase(), expected)
  }

  /** The secret segment of the webhook URL. */
  verifyPathToken(token: string) {
    const expected = env.get('DJOMY_WEBHOOK_PATH_TOKEN')?.release()
    return Boolean(expected) && safeEqual(token, expected!)
  }

  /** Orange Money or MTN MoMo: push to the payer's phone, no redirection (07 §7.2). */
  async directCharge(input: {
    amount: number
    merchantReference: string
    payerPhone: string
    method: 'orange_money' | 'mtn_momo'
    description: string
  }) {
    const body = await this.call('POST', '/v1/payments', {
      amount: input.amount,
      countryCode: 'GN',
      payerIdentifier: payerIdentifier(input.payerPhone),
      paymentMethod: DIRECT_METHOD[input.method],
      merchantPaymentReference: input.merchantReference,
      description: input.description,
    })
    return readTransaction(body)
  }

  /** Card: Djomy portal URL returned to the client (07 §7.2). */
  async gateway(input: {
    amount: number
    merchantReference: string
    method: PaymentMethod
    returnUrl: string
    cancelUrl: string
    description: string
  }) {
    const body = await this.call('POST', '/v1/payments/gateway', {
      amount: input.amount,
      currency: 'GNF',
      countryCode: 'GN',
      paymentMethod: 'CARD',
      merchantPaymentReference: input.merchantReference,
      description: input.description,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
    })
    const data = asRecord(asRecord(body).data ?? body)
    const redirectUrl = asString(
      data.paymentUrl ?? data.redirectUrl ?? data.url ?? data.checkoutUrl
    )
    if (!redirectUrl) throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    return { ...readTransaction(body), redirectUrl }
  }

  /** Server-side verification of a transaction (07 §7.4). */
  async status(transactionId: string) {
    const body = await this.call('GET', `/v1/payments/${encodeURIComponent(transactionId)}/status`)
    return readTransaction(body)
  }

  private baseUrl() {
    return (env.get('DJOMY_BASE_URL') ?? DEFAULT_BASE_URL)
      .replace(/\/+$/, '')
      .replace(/\/v\d+$/, '')
  }

  private apiKey() {
    const clientId = env.get('DJOMY_CLIENT_ID')
    const secret = env.get('DJOMY_CLIENT_SECRET')?.release()
    if (!clientId || !secret) throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    return `${clientId}:${createHmac('sha256', secret).update(clientId).digest('hex')}`
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value
    const response = await this.send(`${this.baseUrl()}/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': this.apiKey() },
      body: '{}',
    })
    if (!response.ok) {
      logger.error({ status: response.status }, 'djomy.auth_failed')
      throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    }
    const payload = asRecord(await response.json())
    const data = asRecord(payload.data ?? payload)
    const value = asString(data.accessToken ?? data.token ?? data.access_token)
    if (!value) throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    const expiresIn = asNumber(data.expiresIn ?? data.expires_in) ?? 3300
    this.token = { value, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000 }
    return value
  }

  private async call(method: 'GET' | 'POST', path: string, payload?: unknown) {
    const token = await this.accessToken()
    const response = await this.send(`${this.baseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey(),
        'Authorization': `Bearer ${token}`,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { raw: text.slice(0, 500) }
    }
    if (!response.ok) {
      logger.error({ status: response.status, path }, 'djomy.request_failed')
      throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    }
    return body
  }

  /** Retries 429, 5xx and network errors with an exponential backoff. */
  private async send(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown = null
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const response = await this.fetcher(url, {
          ...init,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if ((response.status === 429 || response.status >= 500) && attempt < ATTEMPTS - 1) {
          await delay(400 * 2 ** attempt)
          continue
        }
        return response
      } catch (error) {
        lastError = error
        if (attempt < ATTEMPTS - 1) await delay(400 * 2 ** attempt)
      }
    }
    logger.error({ err: lastError }, 'djomy.unreachable')
    throw new AppException('E_DEPENDENCY_UNAVAILABLE')
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default new DjomyClient()
