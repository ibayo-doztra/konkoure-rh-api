import { DateTime } from 'luxon'
import type { AttendanceAnomaly } from '#models/attendance_day'
import type { PunchAnomaly, PunchType } from '#models/time_log'

export interface DayPunch {
  type: PunchType
  punchedAt: DateTime
  anomaly: PunchAnomaly | null
}

export interface DayAggregate {
  firstIn: DateTime | null
  lastOut: DateTime | null
  workedMinutes: number
  punchCount: number
  isComplete: boolean
  anomaly: AttendanceAnomaly | null
}

/**
 * Daily aggregate of 07 §2.8 over the punches of one employee and one local day.
 *
 * Punches are paired in order: an `in` opens a pair, the next `out` closes it
 * and adds its duration. An `in` while a pair is open, or an `out` without
 * one, is a `duplicate` (the first `in` is kept). A pair still open once the
 * day is `closed` is a `missing_out`. One anomaly is kept, in that order:
 * `missing_out`, `duplicate`, `out_of_zone`.
 */
export function aggregateDay(punches: DayPunch[], options: { closed: boolean }): DayAggregate {
  const sorted = [...punches].sort((a, b) => a.punchedAt.toMillis() - b.punchedAt.toMillis())
  let firstIn: DateTime | null = null
  let lastOut: DateTime | null = null
  let open: DateTime | null = null
  let workedMs = 0
  let duplicate = false

  for (const punch of sorted) {
    if (punch.type === 'in') {
      firstIn ??= punch.punchedAt
      if (open) duplicate = true
      else open = punch.punchedAt
    } else {
      lastOut = punch.punchedAt
      if (open) {
        workedMs += punch.punchedAt.toMillis() - open.toMillis()
        open = null
      } else {
        duplicate = true
      }
    }
  }

  const last = sorted.at(-1)
  const isComplete = sorted.length > 0 && sorted.length % 2 === 0 && last?.type === 'out'
  let anomaly: AttendanceAnomaly | null = null
  if (open && options.closed) anomaly = 'missing_out'
  else if (duplicate) anomaly = 'duplicate'
  else if (sorted.some((punch) => punch.anomaly === 'out_of_zone')) anomaly = 'out_of_zone'

  return {
    firstIn,
    lastOut,
    workedMinutes: Math.floor(workedMs / 60_000),
    punchCount: sorted.length,
    isComplete,
    anomaly,
  }
}

/** Local day of an instant, in the organization's timezone (07, header). */
export function localDay(at: DateTime, timezone: string): string {
  return at.setZone(timezone).toISODate()!
}

/** `[start, end[` instants of a local day. */
export function dayBounds(day: string, timezone: string) {
  const start = DateTime.fromISO(day, { zone: timezone }).startOf('day')
  return { start, end: start.plus({ days: 1 }) }
}
