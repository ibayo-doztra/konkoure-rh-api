import { createHmac } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'

/** Limits of docs/backend/05 §10. */
export const OUTBOUND_TIMEOUT_MS = 20_000
export const OUTBOUND_MAX_RESPONSE_BYTES = 256 * 1024

const BLOCKED_SUFFIXES = ['.local', '.internal', '.lan', '.corp', '.home', '.localhost']
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal'])

/** Private, loopback, link-local, CGNAT, multicast and reserved ranges (05 §10 rule 7). */
const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6')
}

export class OutboundUrlError extends Error {}

export function isBlockedAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return blocked.check(mapped[1], 'ipv4')
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family === 6) return blocked.check(address, 'ipv6')
  return true
}

/** Rules 1 to 6 of 05 §10, without any network access. */
export function assertOutboundUrlShape(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new OutboundUrlError('invalid')
  }
  if (url.protocol !== 'https:') throw new OutboundUrlError('https')
  if (url.username || url.password) throw new OutboundUrlError('credentials')
  if (url.port && url.port !== '443') throw new OutboundUrlError('port')
  const host = url.hostname.toLowerCase()
  if (isIP(host.replace(/^\[|\]$/g, ''))) throw new OutboundUrlError('ip')
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.') || host.startsWith('xn--')) {
    throw new OutboundUrlError('host')
  }
  if (host.split('.').some((label) => label.startsWith('xn--'))) throw new OutboundUrlError('host')
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new OutboundUrlError('host')
  }
  return url
}

export type Resolver = (host: string) => Promise<Array<{ address: string; family: number }>>

const systemResolver: Resolver = (host) => dnsLookup(host, { all: true, verbatim: true })

/**
 * `validateOutboundUrl()` (05 §10): shape, then DNS resolution where every
 * address must be public. Returns the address the connection must use
 * (anti-rebinding: the request never resolves the name again).
 */
export async function validateOutboundUrl(raw: string, resolve: Resolver = systemResolver) {
  const url = assertOutboundUrlShape(raw)
  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await resolve(url.hostname)
  } catch {
    throw new OutboundUrlError('dns')
  }
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new OutboundUrlError('private')
  }
  return { url, address: addresses[0].address, family: addresses[0].family }
}

/** `X-Konkoure-Signature` = HMAC-SHA256 of the raw body with the organization's secret (05 §10). */
export function signBody(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export interface OutboundResult {
  status: number | null
  latencyMs: number
  body: string
  error: string | null
}

/**
 * Signed POST of a JSON body (05 §10, 08 §5): validated URL, connection on
 * the validated address, no redirect followed, 20 s timeout, response read up
 * to 256 KB. Never throws: the result carries the error.
 */
export class OutboundClient {
  resolver: Resolver = systemResolver

  async postSigned(rawUrl: string, payload: unknown, secret: string): Promise<OutboundResult> {
    const started = Date.now()
    const elapsed = () => Date.now() - started
    let target
    try {
      target = await validateOutboundUrl(rawUrl, this.resolver)
    } catch (error) {
      const reason = error instanceof OutboundUrlError ? error.message : 'invalid'
      return { status: null, latencyMs: elapsed(), body: '', error: `url_${reason}` }
    }
    const body = JSON.stringify(payload)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    return new Promise((resolve) => {
      const req = request(
        {
          hostname: target.url.hostname,
          servername: target.url.hostname,
          port: 443,
          path: `${target.url.pathname}${target.url.search}`,
          method: 'POST',
          timeout: OUTBOUND_TIMEOUT_MS,
          lookup: (_host, _options, callback) =>
            (callback as (err: null, address: string, family: number) => void)(
              null,
              target.address,
              target.family
            ),
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': 'Konkoure-Webhooks/1.0',
            'X-Konkoure-Timestamp': timestamp,
            'X-Konkoure-Signature': signBody(body, secret),
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          let size = 0
          res.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > OUTBOUND_MAX_RESPONSE_BYTES) {
              res.destroy()
              resolve({
                status: res.statusCode ?? null,
                latencyMs: elapsed(),
                body: '',
                error: 'response_too_large',
              })
              return
            }
            chunks.push(chunk)
          })
          res.on('end', () => {
            const status = res.statusCode ?? null
            const redirected = status !== null && status >= 300 && status < 400
            resolve({
              status,
              latencyMs: elapsed(),
              body: Buffer.concat(chunks).toString('utf8'),
              error: redirected ? 'redirect' : null,
            })
          })
          res.on('error', (error) =>
            resolve({
              status: res.statusCode ?? null,
              latencyMs: elapsed(),
              body: '',
              error: error.message,
            })
          )
        }
      )
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.on('error', (error) =>
        resolve({ status: null, latencyMs: elapsed(), body: '', error: error.message })
      )
      req.end(body)
    })
  }
}

export default new OutboundClient()
