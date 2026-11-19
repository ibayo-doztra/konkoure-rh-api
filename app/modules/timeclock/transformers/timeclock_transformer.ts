import type DeviceToken from '#models/device_token'
import type NfcBadge from '#models/nfc_badge'
import type NfcBadgeEvent from '#models/nfc_badge_event'
import type TimeLog from '#models/time_log'
import type WorkZone from '#models/work_zone'
import type { PunchResult } from '#modules/timeclock/services/punch_service'

const number = (value: string | null) => (value === null ? null : Number(value))

export function zoneDto(zone: WorkZone) {
  return {
    id: zone.id,
    name: zone.name,
    shape: zone.shape,
    latitude: zone.latitude,
    longitude: zone.longitude,
    radiusMeters: zone.radiusMeters,
    polygon: zone.polygon?.coordinates[0] ?? null,
    isActive: zone.isActive,
    timezone: zone.timezone,
    createdAt: zone.createdAt.toISO(),
    updatedAt: zone.updatedAt.toISO(),
  }
}

/** Response of scan, punch and replay (06 §6). */
export function punchDto({ log, employee, zone }: PunchResult) {
  return {
    id: log.id,
    employee: {
      id: employee.id,
      fullName: `${employee.firstName} ${employee.lastName}`,
      photoUrl: employee.photoUrl,
      jobTitle: employee.jobTitle,
    },
    type: log.type,
    punchedAt: log.punchedAt.toISO(),
    source: log.source,
    workZone: zone ? { id: zone.id, name: zone.name } : null,
    isWithinZone: log.isWithinZone,
    distanceMeters: number(log.distanceMeters),
    anomaly: log.anomaly,
  }
}

export function timeLogDto(log: TimeLog) {
  return {
    id: log.id,
    employeeId: log.employeeId,
    type: log.type,
    punchedAt: log.punchedAt.toISO(),
    recordedAt: log.recordedAt.toISO(),
    source: log.source,
    workZoneId: log.workZoneId,
    latitude: log.latitude,
    longitude: log.longitude,
    accuracyMeters: number(log.accuracyMeters),
    distanceMeters: number(log.distanceMeters),
    isWithinZone: log.isWithinZone,
    anomaly: log.anomaly,
    deviceId: log.deviceId,
    notes: log.notes,
    updatedAt: log.updatedAt.toISO(),
  }
}

/** Only the masked UID ever leaves the API (05 §6). */
export function badgeDto(badge: NfcBadge) {
  return {
    id: badge.id,
    employeeId: badge.employeeId,
    uid: badge.uidMasked,
    isActive: badge.isActive,
    assignedAt: badge.assignedAt.toISO(),
    revokedAt: badge.revokedAt?.toISO() ?? null,
  }
}

export function badgeEventDto(event: NfcBadgeEvent) {
  return {
    id: event.id,
    employeeId: event.employeeId,
    badgeId: event.badgeId,
    uid: event.uidMasked,
    event: event.event,
    reason: event.reason,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISO(),
  }
}

export function deviceTokenDto(device: DeviceToken) {
  return {
    id: device.id,
    name: device.name,
    expiresAt: device.expiresAt.toISO(),
    revokedAt: device.revokedAt?.toISO() ?? null,
    lastUsedAt: device.lastUsedAt?.toISO() ?? null,
    createdAt: device.createdAt.toISO(),
  }
}
