import { DateTime } from 'luxon'
import type WorkSchedule from '#models/work_schedule'

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export interface TimeRange {
  /** Local time `HH:MM`. */
  start: string
  end: string
}

export type WeeklyPattern = WorkSchedule['weeklyPattern']

/** Most ranges in one day (a split shift with a lunch break needs two). */
export const MAX_RANGES_PER_DAY = 4
/**
 * After a night range, the next day starts this long after the range's end
 * (a late exit stays on the shift's day), unless the next scheduled range
 * starts sooner (decision of 2026-11-26).
 */
const NIGHT_GRACE_MINUTES = 4 * 60
/** Margin kept before the next scheduled start, for an early arrival. */
const EARLY_ARRIVAL_MINUTES = 60

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** A range whose end is not after its start runs into the next day. */
export const crossesMidnight = (range: TimeRange) => minutesOf(range.end) <= minutesOf(range.start)

const weekdayOf = (day: string) => WEEKDAYS[DateTime.fromISO(day).weekday - 1]
const shift = (day: string, days: number) => DateTime.fromISO(day).plus({ days }).toISODate()!
const rangesOf = (pattern: WeeklyPattern | null, day: string) => pattern?.[weekdayOf(day)] ?? []

/**
 * First problem of a pattern, as a validation rule name, or null. Ranges of a
 * day are in order and do not overlap; only the last one may cross midnight,
 * and then it ends before the first range of the next day.
 */
export function patternProblem(pattern: WeeklyPattern): string | null {
  for (const [index, weekday] of WEEKDAYS.entries()) {
    const ranges = pattern[weekday] ?? []
    let previousEnd = -1
    for (const [position, range] of ranges.entries()) {
      const start = minutesOf(range.start)
      if (start < previousEnd) return 'scheduleOverlap'
      if (crossesMidnight(range)) {
        if (position !== ranges.length - 1) return 'scheduleOverlap'
        const next = pattern[WEEKDAYS[(index + 1) % 7]]?.[0]
        if (next && minutesOf(next.start) < minutesOf(range.end)) return 'scheduleOverlap'
        previousEnd = 24 * 60
      } else {
        previousEnd = minutesOf(range.end)
      }
    }
  }
  return null
}

const at = (day: string, time: string, timezone: string) =>
  DateTime.fromISO(`${day}T${time}`, { zone: timezone })

/** End of the attendance day `day` when its last range crosses midnight, else null. */
function nightBoundary(pattern: WeeklyPattern | null, day: string, timezone: string) {
  const last = rangesOf(pattern, day).at(-1)
  if (!last || !crossesMidnight(last)) return null
  const next = shift(day, 1)
  const end = at(next, last.end, timezone)
  let boundary = end.plus({ minutes: NIGHT_GRACE_MINUTES })
  const nextStart = rangesOf(pattern, next)[0]
  if (nextStart) {
    const early = at(next, nextStart.start, timezone).minus({ minutes: EARLY_ARRIVAL_MINUTES })
    if (early < boundary) boundary = early
  }
  return boundary < end ? end : boundary
}

/**
 * `[start, end[` of an attendance day: the local day, except that a night
 * range keeps the next morning on the day it started (decision of 2026-11-26).
 * Without a schedule, the local day.
 */
export function attendanceWindow(day: string, timezone: string, pattern: WeeklyPattern | null) {
  const midnight = DateTime.fromISO(day, { zone: timezone }).startOf('day')
  return {
    start: nightBoundary(pattern, shift(day, -1), timezone) ?? midnight,
    end: nightBoundary(pattern, day, timezone) ?? midnight.plus({ days: 1 }),
  }
}

/** Attendance day of a punch: its local day, or the day before while a night shift runs. */
export function attendanceDayOf(
  instant: DateTime,
  timezone: string,
  pattern: WeeklyPattern | null
) {
  const local = instant.setZone(timezone).toISODate()!
  const { start } = attendanceWindow(local, timezone, pattern)
  return instant < start ? shift(local, -1) : local
}

/** Start of the first range of the day, or null on a day off. */
export function scheduledStart(day: string, timezone: string, pattern: WeeklyPattern | null) {
  const first = rangesOf(pattern, day)[0]
  return first ? at(day, first.start, timezone) : null
}

/** Delay of the first `in` after the scheduled start, in whole minutes (0 when on time). */
export function lateMinutes(firstIn: DateTime | null, start: DateTime | null) {
  if (!firstIn || !start) return null
  return Math.max(0, Math.floor(firstIn.diff(start, 'minutes').minutes))
}
