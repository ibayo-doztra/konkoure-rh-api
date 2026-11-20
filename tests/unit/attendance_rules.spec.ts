import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  aggregateDay,
  dayBounds,
  localDay,
  type DayPunch,
} from '#modules/timeclock/attendance_rules'

const at = (time: string) => DateTime.fromISO(`2026-11-18T${time}Z`)
const punch = (type: 'in' | 'out', time: string, anomaly: DayPunch['anomaly'] = null) => ({
  type,
  punchedAt: at(time),
  anomaly,
})

test.group('aggregateDay (docs/backend/07 §2.8)', () => {
  test('sums the in/out pairs of a complete day', ({ assert }) => {
    const day = aggregateDay(
      [
        punch('out', '17:00:00'),
        punch('in', '08:00:00'),
        punch('out', '12:00:30'),
        punch('in', '13:00:00'),
      ],
      { closed: false }
    )
    assert.equal(day.firstIn?.toMillis(), at('08:00:00').toMillis())
    assert.equal(day.lastOut?.toMillis(), at('17:00:00').toMillis())
    assert.equal(day.workedMinutes, 8 * 60)
    assert.equal(day.punchCount, 4)
    assert.isTrue(day.isComplete)
    assert.isNull(day.anomaly)
  })

  test('an open pair is incomplete, and missing_out once the day is closed', ({ assert }) => {
    const punches = [punch('in', '08:00:00')]
    const open = aggregateDay(punches, { closed: false })
    assert.isFalse(open.isComplete)
    assert.isNull(open.anomaly)
    assert.equal(open.workedMinutes, 0)
    assert.equal(aggregateDay(punches, { closed: true }).anomaly, 'missing_out')
  })

  test('a repeated in or an orphan out is a duplicate; the first in is kept', ({ assert }) => {
    const repeated = aggregateDay(
      [punch('in', '08:00:00'), punch('in', '08:30:00'), punch('out', '10:00:00')],
      { closed: true }
    )
    assert.equal(repeated.anomaly, 'duplicate')
    assert.equal(repeated.workedMinutes, 120)
    assert.isFalse(repeated.isComplete)

    const orphan = aggregateDay([punch('out', '09:00:00')], { closed: false })
    assert.equal(orphan.anomaly, 'duplicate')
    assert.isNull(orphan.firstIn)
  })

  test('one anomaly: missing_out, then duplicate, then out_of_zone', ({ assert }) => {
    const zone = [punch('in', '08:00:00', 'out_of_zone'), punch('out', '09:00:00')]
    assert.equal(aggregateDay(zone, { closed: true }).anomaly, 'out_of_zone')
    const both = [punch('out', '07:00:00'), punch('in', '08:00:00', 'out_of_zone')]
    assert.equal(aggregateDay(both, { closed: false }).anomaly, 'duplicate')
    assert.equal(aggregateDay(both, { closed: true }).anomaly, 'missing_out')
    // Low accuracy and clock drift do not reach the daily aggregate.
    const low = [punch('in', '08:00:00', 'low_accuracy'), punch('out', '09:00:00', 'clock_drift')]
    assert.isNull(aggregateDay(low, { closed: true }).anomaly)
  })

  test('local days follow the organization timezone', ({ assert }) => {
    // 23:30 in Conakry (UTC+0) is already the next day in Paris (UTC+1).
    const late = DateTime.fromISO('2026-11-18T23:30:00Z')
    assert.equal(localDay(late, 'Africa/Conakry'), '2026-11-18')
    assert.equal(localDay(late, 'Europe/Paris'), '2026-11-19')
    const { start, end } = dayBounds('2026-11-18', 'Europe/Paris')
    assert.equal(start.toUTC().toISO(), '2026-11-17T23:00:00.000Z')
    assert.equal(end.toUTC().toISO(), '2026-11-18T23:00:00.000Z')
  })
})
