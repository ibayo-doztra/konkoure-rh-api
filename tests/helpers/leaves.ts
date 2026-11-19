import { DateTime } from 'luxon'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import type Employee from '#models/employee'
import LeaveBalance from '#models/leave_balance'
import LeaveBalanceLedgerEntry from '#models/leave_balance_ledger_entry'
import LeaveRequest, { type LeaveType } from '#models/leave_request'
import type Organization from '#models/organization'
import PublicHoliday from '#models/public_holiday'

/** Next year: requests stay in the future whatever the day the suite runs. */
export const YEAR = DateTime.now().setZone('Africa/Conakry').year + 1

/** Monday of the `index`-th week after the first Monday of March of `YEAR`. */
export function monday(index = 0) {
  const first = DateTime.fromObject({ year: YEAR, month: 3, day: 1 })
  return first.plus({ days: (8 - first.weekday) % 7, weeks: index })
}

export const iso = (date: DateTime) => date.toISODate()!

/** Monday to Friday of a week. */
export function week(index = 0) {
  const start = monday(index)
  return { startDate: iso(start), endDate: iso(start.plus({ days: 4 })) }
}

export function createLeave(
  employee: Employee,
  overrides: Partial<ModelAttributes<LeaveRequest>> = {}
) {
  const start = monday(20)
  return LeaveRequest.create({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    type: 'annual',
    startDate: start,
    endDate: start.plus({ days: 4 }),
    requestedDays: '5.00',
    ...overrides,
  })
}

export function createHoliday(organization: Organization, date: DateTime, name = 'Férié') {
  return PublicHoliday.create({ organizationId: organization.id, name, date })
}

export async function balanceOf(employee: Employee, type: LeaveType = 'annual', year = YEAR) {
  return LeaveBalance.query()
    .where('employee_id', employee.id)
    .where('year', year)
    .where('leave_type', type)
    .firstOrFail()
}

/** Sum of the ledger of an employee, year and type: always the displayed balance. */
export async function ledgerSum(employee: Employee, type: LeaveType = 'annual', year = YEAR) {
  const rows = await LeaveBalanceLedgerEntry.query()
    .where('employee_id', employee.id)
    .where('year', year)
    .where('leave_type', type)
  return rows.reduce((sum, row) => sum + Number(row.deltaDays), 0)
}

export const displayed = (balance: LeaveBalance) =>
  Number(balance.entitledDays) +
  Number(balance.carriedOverDays) -
  Number(balance.takenDays) -
  Number(balance.pendingDays)
