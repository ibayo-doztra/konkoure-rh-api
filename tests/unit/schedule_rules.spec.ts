import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { aggregateDay } from '#modules/timeclock/attendance_rules'
import {
  attendanceDayOf,
  attendanceWindow,
  lateMinutes,
  patternProblem,
  scheduledStart,
} from '#modules/timeclock/schedule_rules'

const ZONE = 'Africa/Conakry'
const on = (day: string, time: string) => DateTime.fromISO(`${day}T${time}`, { zone: ZONE })
const OFFICE = {
  mon: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
  tue: [{ start: '08:00', end: '17:00' }],
}
/** Night shift on Tuesday, office hours on Wednesday. */
const NIGHT = {
  tue: [{ start: '22:00', end: '06:00' }],
  wed: [{ start: '13:00', end: '18:00' }],
}

test.group('work schedule patterns (decision of 2026-11-26)', () => {
  test('accepts ordered ranges and a last night range', ({ assert }) => {
    assert.isNull(patternProblem(OFFICE))
    assert.isNull(patternProblem(NIGHT))
    assert.isNull(patternProblem({}))
  })

  test('refuses overlaps and a night range that is not last', ({ assert }) => {
    const overlap = {
      mon: [
        { start: '08:00', end: '12:00' },
        { start: '11:00', end: '17:00' },
      ],
    }
    assert.equal(patternProblem(overlap), 'scheduleOverlap')
    const notLast = {
      mon: [
        { start: '22:00', end: '06:00' },
        { start: '23:00', end: '23:30' },
      ],
    }
    assert.equal(patternProblem(notLast), 'scheduleOverlap')
    // Sunday's night range runs into Monday's first range.
    const intoMonday = { sun: [{ start: '22:00', end: '09:00' }], mon: OFFICE.mon }
    assert.equal(patternProblem(intoMonday), 'scheduleOverlap')
  })
})

test.group('attendance window', () => {
  test('without a night range, the local day', ({ assert }) => {
    const { start, end } = attendanceWindow('2026-11-10', ZONE, OFFICE)
    assert.equal(start.toISO(), on('2026-11-10', '00:00').toISO())
    assert.equal(end.toISO(), on('2026-11-11', '00:00').toISO())
    const none = attendanceWindow('2026-11-10', ZONE, null)
    assert.equal(none.end.toISO(), on('2026-11-11', '00:00').toISO())
  })

  test('a night range keeps the next morning on its day', ({ assert }) => {
    // Tuesday 2026-11-10 22:00 → Wednesday 06:00, Wednesday starts at 13:00:
    // the boundary is 06:00 + 4 h = 10:00 (before 13:00 − 1 h).
    const tuesday = attendanceWindow('2026-11-10', ZONE, NIGHT)
    assert.equal(tuesday.end.toISO(), on('2026-11-11', '10:00').toISO())
    const wednesday = attendanceWindow('2026-11-11', ZONE, NIGHT)
    assert.equal(wednesday.start.toISO(), on('2026-11-11', '10:00').toISO())

    assert.equal(attendanceDayOf(on('2026-11-11', '06:20'), ZONE, NIGHT), '2026-11-10')
    assert.equal(attendanceDayOf(on('2026-11-11', '12:55'), ZONE, NIGHT), '2026-11-11')
    assert.equal(attendanceDayOf(on('2026-11-10', '21:58'), ZONE, NIGHT), '2026-11-10')
  })

  test('an early next start shortens the grace', ({ assert }) => {
    const pattern = {
      tue: [{ start: '22:00', end: '06:00' }],
      wed: [{ start: '08:00', end: '12:00' }],
    }
    const { end } = attendanceWindow('2026-11-10', ZONE, pattern)
    assert.equal(end.toISO(), on('2026-11-11', '07:00').toISO())
  })
})

test.group('lateness', () => {
  test('minutes after the first scheduled start', ({ assert }) => {
    const start = scheduledStart('2026-11-09', ZONE, OFFICE)
    assert.equal(start?.toISO(), on('2026-11-09', '08:00').toISO())
    assert.isNull(scheduledStart('2026-11-12', ZONE, OFFICE))
    assert.equal(lateMinutes(on('2026-11-09', '08:12'), start), 12)
    assert.equal(lateMinutes(on('2026-11-09', '07:50'), start), 0)
    assert.isNull(lateMinutes(null, start))
    assert.isNull(lateMinutes(on('2026-11-09', '08:12'), null))
  })

  test('late beyond the tolerance, after missing_out and duplicate', ({ assert }) => {
    const start = on('2026-11-09', '08:00')
    const punches = (time: string) => [
      { type: 'in' as const, punchedAt: on('2026-11-09', time), anomaly: 'out_of_zone' as const },
      { type: 'out' as const, punchedAt: on('2026-11-09', '17:00'), anomaly: null },
    ]
    const options = { closed: true, scheduledStart: start, lateToleranceMinutes: 10 }
    assert.equal(aggregateDay(punches('08:10'), options).anomaly, 'out_of_zone')
    const late = aggregateDay(punches('08:11'), options)
    assert.equal(late.anomaly, 'late')
    assert.equal(late.lateMinutes, 11)
    const open = aggregateDay([punches('08:30')[0]], options)
    assert.equal(open.anomaly, 'missing_out')
    assert.equal(open.lateMinutes, 30)
  })
})
