import type { DateTime } from 'luxon'
import type Plan from '#models/plan'
import type { BillingCycle } from '#models/subscription'

/** Yearly price without an explicit `price_yearly_gnf`: 10 months, 2 offered (decision of 2026-11-24). */
const YEARLY_MONTHS_CHARGED = 10

/** Amount of one period of the plan, in GNF, computed by the server only (07 §7.1). */
export function planAmount(plan: Plan, cycle: BillingCycle): number {
  const monthly = Number(plan.priceGnf)
  if (cycle === 'monthly') return monthly
  return plan.priceYearlyGnf === null
    ? monthly * YEARLY_MONTHS_CHARGED
    : Number(plan.priceYearlyGnf)
}

/** End of a period starting at `from`. */
export function periodEnd(from: DateTime, cycle: BillingCycle): DateTime {
  return cycle === 'yearly' ? from.plus({ years: 1 }) : from.plus({ months: 1 })
}

/** Usage period `AAAA-MM` (02 §9), in UTC, which is Guinea's time. */
export function usagePeriod(at: DateTime): string {
  return at.toUTC().toFormat('yyyy-MM')
}
