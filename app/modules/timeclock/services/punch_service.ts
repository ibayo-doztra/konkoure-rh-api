import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Employee from '#models/employee'
import type TimeLog from '#models/time_log'
import type { PunchAnomaly, PunchSource, PunchType } from '#models/time_log'
import type WorkZone from '#models/work_zone'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { badgesIn } from '#modules/timeclock/repositories/badge_repository'
import { timeLogsIn } from '#modules/timeclock/repositories/time_log_repository'
import { workZonesIn } from '#modules/timeclock/repositories/work_zone_repository'
import { badgeIdentity } from '#modules/timeclock/services/badge_service'
import attendanceService from '#modules/timeclock/services/attendance_service'
import {
  haversineMeters,
  insidePolygon,
  maskUid,
  ringCenter,
  timeclockSettings,
  type Point,
  type TimeclockSettings,
} from '#modules/timeclock/timeclock_rules'

/** Offline window of 07 §2.7. */
const MAX_PAST_HOURS = 72
const MAX_FUTURE_MINUTES = 5
/** Rate limits of 05 §6. */
const SCANS_PER_DEVICE = 30
const SCANS_PER_ORGANIZATION = 300

export interface PunchInput {
  type?: PunchType
  punchedAt?: DateTime
  latitude?: number
  longitude?: number
  accuracyMeters?: number
  deviceId?: string
  clientPunchId?: string
}

/** Who records the punch: a member session, or a kiosk token (05 §6). */
export type PunchActor = { kind: 'user'; user: User } | { kind: 'device'; deviceTokenId: string }

export interface PunchResult {
  log: TimeLog
  employee: Employee
  zone: WorkZone | null
  /** The `clientPunchId` was already known: the existing punch is returned (07 §2.5). */
  replayed: boolean
  /** Organization timezone, for the attendance day of the punch. */
  timezone: string
}

export interface SyncItem extends PunchInput {
  badgeUid?: string
  clientPunchId: string
}

export interface SyncOutcome {
  clientPunchId: string
  status: 'created' | 'duplicate' | 'rejected'
  reason?: string
  id?: string
}

interface ZoneMatch {
  zone: WorkZone | null
  distance: number | null
  inside: boolean
}

const actorUserId = (actor: PunchActor) => (actor.kind === 'user' ? actor.user.id : null)

/**
 * Punches (docs/backend/06 §6, 07 §2.3–2.7): badge scans, punches for
 * oneself and offline batches. Scans stay free of any external call.
 */
export class PunchService {
  async scan(
    tenant: TenantContext,
    actor: PunchActor,
    badgeUid: string,
    input: PunchInput,
    ip: string | null
  ): Promise<PunchResult> {
    await this.throttle(tenant.organizationId, actor, input.deviceId)
    return this.scanOne(tenant, actor, badgeUid, input, ip)
  }

  /** For oneself, manual or GPS (06 §6): refused when the organization disables it. */
  async self(tenant: TenantContext, user: User, input: PunchInput): Promise<PunchResult> {
    const employeeId = tenant.employeeId
    if (!employeeId) {
      throw new AppException('E_FORBIDDEN', {
        details: [
          { field: 'employee', rule: 'linked', message: 'validation.timeclock.noEmployee' },
        ],
      })
    }
    const source: PunchSource =
      input.latitude !== undefined && input.longitude !== undefined ? 'mobile_gps' : 'manual'
    const result = await withTenant(tenant.organizationId, async (trx) => {
      const settings = await this.settings(trx, tenant.organizationId)
      if (!settings.allowManualPunch) throw new AppException('E_MANUAL_PUNCH_DISABLED')
      const employee = await employeesIn(tenant.organizationId, trx).find(employeeId)
      if (!employee) throw new AppException('E_NOT_FOUND')
      return this.record(trx, tenant.organizationId, employee, source, input, user.id)
    })
    await this.recorded(tenant.organizationId, result)
    return result
  }

  /**
   * Offline batch (06 §6): each item in its own transaction, so one rejected
   * punch never cancels the others. Items with `badgeUid` are scans; the
   * others are punches for oneself (member sessions only).
   */
  async sync(
    tenant: TenantContext,
    actor: PunchActor,
    items: SyncItem[],
    canScan: boolean,
    ip: string | null
  ): Promise<SyncOutcome[]> {
    await this.throttle(tenant.organizationId, actor, items[0]?.deviceId)
    const outcomes: SyncOutcome[] = []
    for (const item of items) {
      const { badgeUid, ...input } = item
      try {
        let result: PunchResult
        if (badgeUid) {
          if (!canScan) throw new AppException('E_FORBIDDEN')
          result = await this.scanOne(tenant, actor, badgeUid, input, ip)
        } else {
          if (actor.kind !== 'user') throw new AppException('E_FORBIDDEN')
          result = await this.self(tenant, actor.user, input)
        }
        outcomes.push({
          clientPunchId: item.clientPunchId,
          status: result.replayed ? 'duplicate' : 'created',
          id: result.log.id,
        })
      } catch (error) {
        if (!(error instanceof AppException)) {
          logger.error({ err: error, clientPunchId: item.clientPunchId }, 'timeclock.sync_failed')
        }
        outcomes.push({
          clientPunchId: item.clientPunchId,
          status: 'rejected',
          reason: error instanceof AppException ? error.errorCode : 'E_INTERNAL',
        })
      }
    }
    return outcomes
  }

  private async scanOne(
    tenant: TenantContext,
    actor: PunchActor,
    badgeUid: string,
    input: PunchInput,
    ip: string | null
  ): Promise<PunchResult> {
    const { organizationId } = tenant
    const identity = badgeIdentity(badgeUid)
    const found = identity
      ? await withTenant(organizationId, async (trx) => {
          const badge = await badgesIn(organizationId, trx).findByHash(identity.hash)
          if (!badge) return null
          const employee = await employeesIn(organizationId, trx).find(badge.employeeId)
          return employee ? { badge, employee } : null
        })
      : null

    if (!found) {
      // Unknown here, foreign or malformed: same answer, journaled (07 §2.3).
      const masked = identity?.masked ?? maskUid(badgeUid.replace(/[\s:.-]/g, '').toUpperCase())
      await withTenant(organizationId, (trx) =>
        badgesIn(organizationId, trx).record({
          uidMasked: masked,
          event: 'scan_rejected',
          reason: 'unknown',
          actorUserId: actorUserId(actor),
          ip,
        })
      )
      throw new AppException('E_BADGE_UNKNOWN')
    }
    if (!found.badge.isActive || found.employee.status === 'suspended') {
      throw new AppException('E_BADGE_INACTIVE')
    }

    const source: PunchSource = actor.kind === 'device' ? 'kiosk' : 'nfc'
    const result = await withTenant(organizationId, (trx) =>
      this.record(trx, organizationId, found.employee, source, input, actorUserId(actor))
    )
    await this.recorded(organizationId, result)
    return result
  }

  /** After the commit: the attendance day of a new punch is recomputed (08 §3). */
  private async recorded(organizationId: string, result: PunchResult) {
    if (result.replayed) return
    await attendanceService.punchChanged({
      organizationId,
      employeeId: result.employee.id,
      timezone: result.timezone,
      instants: [result.log.punchedAt],
    })
  }

  /** One punch: offline window, idempotency, zone, type, duplicate window (07 §2.4–2.7). */
  private async record(
    trx: TransactionClientContract,
    organizationId: string,
    employee: Employee,
    source: PunchSource,
    input: PunchInput,
    createdBy: string | null
  ): Promise<PunchResult> {
    const organization = await organizations.findActive(organizationId, trx)
    if (!organization) throw new AppException('E_NOT_FOUND')
    const settings = timeclockSettings(organization.settings)
    const logs = timeLogsIn(organizationId, trx)
    await logs.lockEmployee(employee.id)

    if (input.clientPunchId) {
      const known = await logs.findByClientId(employee.id, input.clientPunchId)
      if (known) {
        const zone = known.workZoneId
          ? await workZonesIn(organizationId, trx).find(known.workZoneId)
          : null
        return { log: known, employee, zone, replayed: true, timezone: organization.timezone }
      }
    }

    const now = DateTime.now()
    let anomaly: PunchAnomaly | null = null
    let punchedAt = input.punchedAt ?? now
    if (
      punchedAt < now.minus({ hours: MAX_PAST_HOURS }) ||
      punchedAt > now.plus({ minutes: MAX_FUTURE_MINUTES })
    ) {
      punchedAt = now
      anomaly = 'clock_drift'
    }

    const lowAccuracy =
      input.accuracyMeters !== undefined && input.accuracyMeters > settings.maxAccuracyMeters
    const hasPoint = input.latitude !== undefined && input.longitude !== undefined
    const match: ZoneMatch = hasPoint
      ? await this.locate(organizationId, trx, {
          latitude: input.latitude!,
          longitude: input.longitude!,
        })
      : { zone: null, distance: null, inside: false }
    // A punch for oneself must prove its position; a badge reader is fixed.
    const mustLocate = settings.requireZone && (source === 'manual' || source === 'mobile_gps')
    if (lowAccuracy) {
      anomaly ??= 'low_accuracy'
    } else if (hasPoint && !match.inside) {
      if (settings.requireZone) throw new AppException('E_OUT_OF_ZONE')
      anomaly ??= 'out_of_zone'
    } else if (!hasPoint && mustLocate) {
      throw new AppException('E_OUT_OF_ZONE')
    }

    const timezone = match.zone?.timezone ?? organization.timezone
    const type = input.type ?? (await this.deduceType(logs, employee.id, punchedAt, timezone))
    const window = settings.duplicateWindowSeconds
    const duplicate = await logs.sameTypeWithin(
      employee.id,
      type,
      punchedAt.minus({ seconds: window }).toISO()!,
      punchedAt.plus({ seconds: window }).toISO()!
    )
    if (duplicate) throw new AppException('E_DUPLICATE_PUNCH')

    const log = await logs.create({
      employeeId: employee.id,
      type,
      punchedAt,
      recordedAt: now,
      source,
      workZoneId: match.inside ? match.zone!.id : null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracyMeters: input.accuracyMeters === undefined ? null : String(input.accuracyMeters),
      distanceMeters: match.distance === null ? null : match.distance.toFixed(2),
      isWithinZone: match.inside,
      anomaly,
      deviceId: input.deviceId ?? null,
      clientPunchId: input.clientPunchId ?? null,
      createdBy,
    })
    if (input.clientPunchId) await logs.rememberClientId(log)
    return {
      log,
      employee,
      zone: match.inside ? match.zone : null,
      replayed: false,
      timezone: organization.timezone,
    }
  }

  /** Last punch of the same local day: none or `out` ⇒ `in`, else `out` (07 §2.4). */
  private async deduceType(
    logs: ReturnType<typeof timeLogsIn>,
    employeeId: string,
    punchedAt: DateTime,
    timezone: string
  ): Promise<PunchType> {
    const dayStart = punchedAt.setZone(timezone).startOf('day')
    const last = await logs.latestBetween(employeeId, dayStart.toISO()!, punchedAt.toISO()!)
    return !last || last.type === 'out' ? 'in' : 'out'
  }

  /**
   * Active zones containing the point (circle: haversine ≤ radius; polygon:
   * ray casting), the closest centre first. Outside every zone, the distance
   * to the closest centre is still reported.
   */
  private async locate(
    organizationId: string,
    trx: TransactionClientContract,
    point: Point
  ): Promise<ZoneMatch> {
    const zones = await workZonesIn(organizationId, trx).active()
    let best: ZoneMatch = { zone: null, distance: null, inside: false }
    for (const zone of zones) {
      let distance: number
      let inside: boolean
      if (zone.shape === 'circle') {
        distance = haversineMeters(point, { latitude: zone.latitude!, longitude: zone.longitude! })
        inside = distance <= zone.radiusMeters!
      } else {
        const ring = zone.polygon!.coordinates[0]
        distance = haversineMeters(point, ringCenter(ring))
        inside = insidePolygon(point, ring)
      }
      const better =
        best.zone === null ||
        (inside && !best.inside) ||
        (inside === best.inside && distance < best.distance!)
      if (better) best = { zone, distance, inside }
    }
    return best
  }

  private async settings(trx: TransactionClientContract, organizationId: string) {
    const organization = await organizations.findActive(organizationId, trx)
    if (!organization) throw new AppException('E_NOT_FOUND')
    return timeclockSettings(organization.settings) satisfies TimeclockSettings
  }

  /** 30 scans per minute per device, 300 per organization (05 §6). */
  private async throttle(organizationId: string, actor: PunchActor, deviceId?: string) {
    const device =
      actor.kind === 'device'
        ? `token:${actor.deviceTokenId}`
        : deviceId
          ? `device:${organizationId}:${deviceId}`
          : `user:${actor.user.id}`
    await limiter
      .use({ requests: SCANS_PER_DEVICE, duration: '1 minute' })
      .consume(`scan:${device}`)
    await limiter
      .use({ requests: SCANS_PER_ORGANIZATION, duration: '1 minute' })
      .consume(`scan:org:${organizationId}`)
  }
}

export default new PunchService()
