import { createHash } from 'node:crypto'

/** `organizations.settings.timeclock` with the defaults of docs/backend/02 §11. */
export interface TimeclockSettings {
  defaultRadiusMeters: number
  requireZone: boolean
  allowManualPunch: boolean
  maxAccuracyMeters: number
  duplicateWindowSeconds: number
}

const DEFAULTS: TimeclockSettings = {
  defaultRadiusMeters: 150,
  requireZone: true,
  allowManualPunch: true,
  maxAccuracyMeters: 100,
  duplicateWindowSeconds: 120,
}

export function timeclockSettings(settings: Record<string, unknown> | null): TimeclockSettings {
  const raw = (settings?.timeclock ?? {}) as Partial<Record<keyof TimeclockSettings, unknown>>
  const num = (key: 'defaultRadiusMeters' | 'maxAccuracyMeters' | 'duplicateWindowSeconds') => {
    const value = raw[key]
    return typeof value === 'number' ? value : DEFAULTS[key]
  }
  const bool = (key: 'requireZone' | 'allowManualPunch') => {
    const value = raw[key]
    return typeof value === 'boolean' ? value : DEFAULTS[key]
  }
  return {
    defaultRadiusMeters: num('defaultRadiusMeters'),
    requireZone: bool('requireZone'),
    allowManualPunch: bool('allowManualPunch'),
    maxAccuracyMeters: num('maxAccuracyMeters'),
    duplicateWindowSeconds: num('duplicateWindowSeconds'),
  }
}

/**
 * Canonical NFC UID (07 §2.2), or null when it is not a UID:
 * 1. drop spaces, `:`, `-`, `.`; 2. upper case; 3. hexadecimal is kept;
 * 4. a purely decimal value (Android readers returning an integer) becomes
 *    big-endian hexadecimal padded to an even length; 5. leading zeros
 *    beyond 8 characters are dropped.
 * Digits written with byte separators (`04:12:34:56`) are hexadecimal bytes,
 * not a decimal integer.
 */
export function normalizeUid(raw: string): string | null {
  const separated = /[\s:.-]/.test(raw.trim())
  let uid = raw.replace(/[\s:.-]/g, '').toUpperCase()
  if (uid.length === 0) return null

  if (/^\d+$/.test(uid) && !separated) {
    uid = BigInt(uid).toString(16).toUpperCase()
    if (uid.length % 2 === 1) uid = `0${uid}`
  } else if (!/^[0-9A-F]+$/.test(uid)) {
    return null
  }
  while (uid.length > 8 && uid.startsWith('0')) uid = uid.slice(1)
  if (uid.length % 2 === 1) uid = `0${uid}`
  return uid.length >= 4 && uid.length <= 32 ? uid : null
}

/** Lookup key: SHA-256 of the canonical UID and the server pepper (05 §6). */
export const uidHash = (normalized: string, pepper: string) =>
  createHash('sha256').update(`${normalized}${pepper}`).digest('hex')

/** The only readable form ever stored or returned: the last four characters. */
export const maskUid = (normalized: string) => `••••${normalized.slice(-4)}`

export type Point = { latitude: number; longitude: number }

const EARTH_RADIUS_METERS = 6_371_008.8
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance in meters (07 §2.1). */
export function haversineMeters(a: Point, b: Point): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** GeoJSON ring: `[longitude, latitude]` pairs, first = last. */
export type Ring = number[][]

/** Ray casting on the exterior ring (07 §2.1). */
export function insidePolygon(point: Point, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Centroid of the ring vertices, used to report a distance for polygon zones. */
export function ringCenter(ring: Ring): Point {
  const vertices = ring.slice(0, -1)
  const sum = vertices.reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0])
  return { longitude: sum[0] / vertices.length, latitude: sum[1] / vertices.length }
}

const orientation = (p: number[], q: number[], r: number[]) =>
  Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]))

function segmentsCross(a: number[], b: number[], c: number[], d: number[]) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0
}

/**
 * Polygon rule of 07 §2.1: closed ring (first = last), at least 4 points
 * (a triangle), at most 100, valid coordinates, no self-intersection.
 * Returns the failed rule, or null.
 */
export function polygonProblem(ring: Ring): string | null {
  if (ring.length < 4 || ring.length > 100) return 'pointCount'
  const valid = ring.every(
    (pair) =>
      pair.length === 2 &&
      pair.every(Number.isFinite) &&
      Math.abs(pair[0]) <= 180 &&
      Math.abs(pair[1]) <= 90
  )
  if (!valid) return 'coordinates'
  const [first, last] = [ring[0], ring[ring.length - 1]]
  if (first[0] !== last[0] || first[1] !== last[1]) return 'notClosed'
  const edges = ring.length - 1
  for (let i = 0; i < edges; i += 1) {
    for (let j = i + 1; j < edges; j += 1) {
      // Adjacent edges share a vertex, including the closing pair.
      if (j === i + 1 || (i === 0 && j === edges - 1)) continue
      if (segmentsCross(ring[i], ring[i + 1], ring[j], ring[j + 1])) return 'selfIntersecting'
    }
  }
  return null
}
