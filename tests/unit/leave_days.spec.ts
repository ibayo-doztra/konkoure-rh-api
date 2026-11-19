import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  countLeaveDays,
  leaveSettings,
  recurringOn,
  type DayCountInput,
} from '#modules/leaves/leave_rules'

// 2027-03-01 is a Monday.
const base: DayCountInput = {
  startDate: '2027-03-01',
  endDate: '2027-03-05',
  halfDayStart: false,
  halfDayEnd: false,
  holidays: new Set(),
  countWeekends: false,
  countHolidays: false,
}

test.group('countLeaveDays (docs/backend/07 §3.1)', () => {
  test('counts the working days of a week', ({ assert }) => {
    assert.equal(countLeaveDays(base), 5)
  })

  test('skips weekends unless they are counted', ({ assert }) => {
    const twoWeeks = { ...base, endDate: '2027-03-14' }
    assert.equal(countLeaveDays(twoWeeks), 10)
    assert.equal(countLeaveDays({ ...twoWeeks, countWeekends: true }), 14)
  })

  test('skips holidays unless they are counted', ({ assert }) => {
    const holidays = new Set(['2027-03-03'])
    assert.equal(countLeaveDays({ ...base, holidays }), 4)
    assert.equal(countLeaveDays({ ...base, holidays, countHolidays: true }), 5)
  })

  test('removes half a day at each half-day end', ({ assert }) => {
    assert.equal(countLeaveDays({ ...base, halfDayStart: true }), 4.5)
    assert.equal(countLeaveDays({ ...base, halfDayStart: true, halfDayEnd: true }), 4)
    const oneDay = { ...base, endDate: '2027-03-01' }
    assert.equal(countLeaveDays({ ...oneDay, halfDayEnd: true }), 0.5)
    assert.equal(countLeaveDays({ ...oneDay, halfDayStart: true, halfDayEnd: true }), 0)
  })

  test('a half day on a day that is not counted removes nothing', ({ assert }) => {
    // Saturday 6 to Monday 8: only Monday counts.
    const weekend = { ...base, startDate: '2027-03-06', endDate: '2027-03-08' }
    assert.equal(countLeaveDays({ ...weekend, halfDayStart: true }), 1)
  })

  test('returns zero for a weekend only', ({ assert }) => {
    assert.equal(countLeaveDays({ ...base, startDate: '2027-03-06', endDate: '2027-03-07' }), 0)
  })
})

test.group('leave settings and holidays', () => {
  test('applies the defaults of 02 §11 to missing or invalid keys', ({ assert }) => {
    assert.deepEqual(leaveSettings({}), {
      annualEntitlementDays: 30,
      allowNegativeBalance: true,
      maxNegativeDays: 5,
      countWeekends: false,
      countHolidays: false,
      maxCarryOverDays: 10,
    })
    const custom = leaveSettings({ leave: { maxNegativeDays: 0, countWeekends: 'yes' } })
    assert.equal(custom.maxNegativeDays, 0)
    assert.isFalse(custom.countWeekends)
  })

  test('moves a recurring holiday to another year', ({ assert }) => {
    assert.equal(recurringOn(DateTime.fromISO('2020-10-02'), 2027), '2027-10-02')
    assert.isNull(recurringOn(DateTime.fromISO('2024-02-29'), 2027))
  })
})
