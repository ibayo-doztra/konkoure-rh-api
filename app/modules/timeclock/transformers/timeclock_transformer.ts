import type DeviceToken from '#models/device_token'
import type NfcBadge from '#models/nfc_badge'
import type NfcBadgeEvent from '#models/nfc_badge_event'
import type TimeLog from '#models/time_log'
import type AttendanceDay from '#models/attendance_day'
import type Employee from '#models/employee'
import type WorkSchedule from '#models/work_schedule'
import type WorkZone from '#models/work_zone'
import { WEEKDAYS } from '#modules/timeclock/schedule_rules'
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

export function attendanceDayDto(day: AttendanceDay) {
  return {
    employeeId: day.employeeId,
    day: day.day.toISODate(),
    firstIn: day.firstIn?.toISO() ?? null,
    lastOut: day.lastOut?.toISO() ?? null,
    workedMinutes: day.workedMinutes,
    punchCount: day.punchCount,
    isComplete: day.isComplete,
    lateMinutes: day.lateMinutes,
    anomaly: day.anomaly,
  }
}

/** Every weekday is present in the output, `[]` for a day off. */
export function workScheduleDto(schedule: WorkSchedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    isDefault: schedule.isDefault,
    employeeId: schedule.employeeId,
    weeklyPattern: Object.fromEntries(
      WEEKDAYS.map((day) => [day, schedule.weeklyPattern[day] ?? []])
    ),
    createdAt: schedule.createdAt.toISO(),
    updatedAt: schedule.updatedAt.toISO(),
  }
}

const rosterEntry = (employee: Employee) => ({
  employeeId: employee.id,
  fullName: `${employee.firstName} ${employee.lastName}`,
  departmentId: employee.departmentId,
})

export function todayDto(board: {
  date: string
  isHoliday: boolean
  present: Array<{ employee: Employee; day: AttendanceDay }>
  absent: Employee[]
  onLeave: Employee[]
}) {
  return {
    date: board.date,
    isHoliday: board.isHoliday,
    counts: {
      total: board.present.length + board.absent.length + board.onLeave.length,
      present: board.present.length,
      absent: board.absent.length,
      onLeave: board.onLeave.length,
    },
    present: board.present.map(({ employee, day }) => ({
      ...rosterEntry(employee),
      firstIn: day.firstIn?.toISO() ?? null,
      lastOut: day.lastOut?.toISO() ?? null,
      isComplete: day.isComplete,
      anomaly: day.anomaly,
    })),
    absent: board.absent.map(rosterEntry),
    onLeave: board.onLeave.map(rosterEntry),
  }
}
