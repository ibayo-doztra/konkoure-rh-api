import { DateTime } from 'luxon'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import type Employee from '#models/employee'
import NfcBadge from '#models/nfc_badge'
import type Organization from '#models/organization'
import TimeLog from '#models/time_log'
import WorkZone from '#models/work_zone'
import { badgeIdentity } from '#modules/timeclock/services/badge_service'

/** Siège Kaloum, Conakry. */
export const KALOUM = { latitude: 9.5092, longitude: -13.7122 }
/** About 55 m north of KALOUM: inside a 200 m circle. */
export const NEAR = { latitude: 9.5097, longitude: -13.7122 }
/** About 1.1 km north of KALOUM. */
export const FAR = { latitude: 9.5192, longitude: -13.7122 }

export function createZone(
  organization: Organization,
  overrides: Partial<ModelAttributes<WorkZone>> = {}
) {
  return WorkZone.create({
    organizationId: organization.id,
    name: `Siège ${Math.random().toString(36).slice(2, 8)}`,
    shape: 'circle',
    latitude: KALOUM.latitude,
    longitude: KALOUM.longitude,
    radiusMeters: 200,
    ...overrides,
  })
}

export function giveBadge(employee: Employee, uid: string) {
  const identity = badgeIdentity(uid)!
  return NfcBadge.create({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    uidHash: identity.hash,
    uidMasked: identity.masked,
    assignedAt: DateTime.now(),
  })
}

export function createPunch(employee: Employee, overrides: Partial<ModelAttributes<TimeLog>> = {}) {
  return TimeLog.create({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    type: 'in',
    punchedAt: DateTime.now().minus({ hours: 2 }),
    recordedAt: DateTime.now(),
    source: 'nfc',
    ...overrides,
  })
}

export async function setTimeclockSettings(
  organization: Organization,
  timeclock: Record<string, unknown>
) {
  organization.merge({ settings: { ...organization.settings, timeclock } })
  await organization.save()
}
