import { DateTime } from 'luxon'

export type DashboardPeriod = 'week' | 'month' | 'quarter'

/**
 * Current calendar week (Monday to Sunday), month or quarter in the
 * organization's timezone, as ISO dates, plus the `[start, end[` instants.
 */
export function periodBounds(
  period: DashboardPeriod,
  timezone: string,
  at: DateTime = DateTime.now()
) {
  const start = at.setZone(timezone).startOf(period)
  const end = start.plus({ [`${period}s`]: 1 })
  return {
    from: start.toISODate()!,
    to: end.minus({ days: 1 }).toISODate()!,
    start,
    end,
  }
}

/** First day of each of the last 12 months, the current one included. */
export function lastTwelveMonths(timezone: string, at: DateTime = DateTime.now()) {
  const current = at.setZone(timezone).startOf('month')
  return { first: current.minus({ months: 11 }).toISODate()!, last: current.toISODate()! }
}
