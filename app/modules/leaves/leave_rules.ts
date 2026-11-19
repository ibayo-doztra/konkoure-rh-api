import { DateTime } from 'luxon'
import type { LeaveType } from '#models/leave_request'

/** `organizations.settings.leave` with the defaults of docs/backend/02 §11. */
export interface LeaveSettings {
  annualEntitlementDays: number
  allowNegativeBalance: boolean
  maxNegativeDays: number
  countWeekends: boolean
  countHolidays: boolean
  /** Ceiling of the annual carry-over (07 §3.8). */
  maxCarryOverDays: number
}

const DEFAULTS: LeaveSettings = {
  annualEntitlementDays: 30,
  allowNegativeBalance: true,
  maxNegativeDays: 5,
  countWeekends: false,
  countHolidays: false,
  maxCarryOverDays: 10,
}

export function leaveSettings(settings: Record<string, unknown> | null): LeaveSettings {
  const leave = (settings?.leave ?? {}) as Partial<Record<keyof LeaveSettings, unknown>>
  const num = (key: 'annualEntitlementDays' | 'maxNegativeDays' | 'maxCarryOverDays') => {
    const value = leave[key]
    return typeof value === 'number' ? value : DEFAULTS[key]
  }
  const bool = (key: 'allowNegativeBalance' | 'countWeekends' | 'countHolidays') => {
    const value = leave[key]
    return typeof value === 'boolean' ? value : DEFAULTS[key]
  }
  return {
    annualEntitlementDays: num('annualEntitlementDays'),
    allowNegativeBalance: bool('allowNegativeBalance'),
    maxNegativeDays: num('maxNegativeDays'),
    countWeekends: bool('countWeekends'),
    countHolidays: bool('countHolidays'),
    maxCarryOverDays: num('maxCarryOverDays'),
  }
}

/** Types that consume a balance and are bound by the negative limit (07 §3.3). */
export const BALANCE_TYPES: readonly LeaveType[] = ['annual', 'special']

export const consumesBalance = (type: LeaveType) => BALANCE_TYPES.includes(type)

/** Days granted when a balance row is first opened for a year (no proration). */
export const initialEntitlement = (type: LeaveType, settings: LeaveSettings) =>
  type === 'annual' ? settings.annualEntitlementDays : 0

export interface DayCountInput {
  startDate: string
  endDate: string
  halfDayStart: boolean
  halfDayEnd: boolean
  /** ISO dates (`yyyy-mm-dd`) of the organization holidays within the range. */
  holidays: ReadonlySet<string>
  countWeekends: boolean
  countHolidays: boolean
}

/** Saturday and Sunday (Guinea). */
const isWeekend = (date: DateTime) => date.weekday >= 6

/**
 * Requested days, computed server-side only (07 §3.1): calendar days minus
 * weekends and holidays when they are not counted, minus half a day for each
 * half-day end. A half day only applies to a day that is itself counted.
 */
export function countLeaveDays(input: DayCountInput): number {
  const start = DateTime.fromISO(input.startDate, { zone: 'utc' })
  const end = DateTime.fromISO(input.endDate, { zone: 'utc' })
  const counted = (date: DateTime) =>
    (input.countWeekends || !isWeekend(date)) &&
    (input.countHolidays || !input.holidays.has(date.toISODate()!))

  let days = 0
  for (let date = start; date <= end; date = date.plus({ days: 1 })) {
    if (counted(date)) days += 1
  }
  if (input.halfDayStart && counted(start)) days -= 0.5
  if (input.halfDayEnd && counted(end)) days -= 0.5
  return days
}

/** The ISO date of a recurring holiday moved to `year`, null on 29 February of a common year. */
export function recurringOn(date: DateTime, year: number): string | null {
  const moved = date.set({ year })
  return moved.month === date.month && moved.day === date.day ? moved.toISODate() : null
}

/** Fixed Guinean holidays (07 §9); movable ones are entered every year. */
export const GUINEA_FIXED_HOLIDAYS: ReadonlyArray<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "Jour de l'An" },
  { month: 4, day: 3, name: 'Jour de la Deuxième République' },
  { month: 5, day: 1, name: 'Fête du travail' },
  { month: 5, day: 25, name: "Journée de l'Afrique" },
  { month: 8, day: 15, name: 'Assomption' },
  { month: 10, day: 2, name: "Fête de l'indépendance" },
  { month: 11, day: 1, name: 'Toussaint' },
  { month: 12, day: 25, name: 'Noël' },
]
