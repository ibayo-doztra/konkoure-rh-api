import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { lastTwelveMonths, periodBounds } from '#modules/dashboard/dashboard_rules'
import { decodeCursor, encodeCursor } from '#shared/pagination/cursor'

test.group('Dashboard periods (06 §3)', () => {
  // Thursday 20 November 2026, 23:30 UTC: already Friday in Paris.
  const at = DateTime.fromISO('2026-11-20T23:30:00Z')

  test('week, month and quarter of the organization timezone', ({ assert }) => {
    const week = periodBounds('week', 'Africa/Conakry', at)
    assert.deepInclude(week, { from: '2026-11-16', to: '2026-11-22' })
    assert.deepInclude(periodBounds('month', 'Africa/Conakry', at), {
      from: '2026-11-01',
      to: '2026-11-30',
    })
    assert.deepInclude(periodBounds('quarter', 'Africa/Conakry', at), {
      from: '2026-10-01',
      to: '2026-12-31',
    })
    assert.equal(week.end.diff(week.start, 'days').days, 7)
  })

  test('the local date decides the period', ({ assert }) => {
    const late = DateTime.fromISO('2026-11-30T23:30:00Z')
    assert.equal(periodBounds('month', 'Africa/Conakry', late).from, '2026-11-01')
    assert.equal(periodBounds('month', 'Europe/Paris', late).from, '2026-12-01')
  })

  test('the last twelve months end with the current one', ({ assert }) => {
    assert.deepEqual(lastTwelveMonths('Africa/Conakry', at), {
      first: '2025-12-01',
      last: '2026-11-01',
    })
  })
})

test.group('Cursor pagination (01 §7)', () => {
  test('round trip, and a forged cursor is a validation error', ({ assert }) => {
    const id = '01a1f974-29ed-7fd5-9c23-1d6c8836f514'
    const cursor = encodeCursor(DateTime.fromISO('2026-11-20T10:00:00Z'), id)
    assert.deepEqual(decodeCursor(cursor), { createdAt: '2026-11-20T10:00:00.000Z', id })
    for (const forged of ['abc', Buffer.from('{"id":"x"}').toString('base64url')]) {
      assert.throws(() => decodeCursor(forged), /E_VALIDATION|Validation/)
    }
  })
})
