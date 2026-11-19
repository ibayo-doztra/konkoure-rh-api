import type LeaveBalance from '#models/leave_balance'
import type LeaveRequest from '#models/leave_request'
import type PublicHoliday from '#models/public_holiday'
import type { LeaveView } from '#modules/leaves/services/leave_service'
import { displayedBalance } from '#modules/leaves/services/leave_balance_service'

/** The storage path of the attachment is never returned. */
export function leaveDto(leave: LeaveRequest) {
  return {
    id: leave.id,
    employeeId: leave.employeeId,
    type: leave.type,
    status: leave.status,
    startDate: leave.startDate.toISODate(),
    endDate: leave.endDate.toISODate(),
    halfDayStart: leave.halfDayStart,
    halfDayEnd: leave.halfDayEnd,
    requestedDays: Number(leave.requestedDays),
    reason: leave.reason,
    decisionComment: leave.decisionComment,
    decidedBy: leave.decidedBy,
    decidedAt: leave.decidedAt?.toISO() ?? null,
    hasAttachment: leave.attachmentPath !== null,
    createdAt: leave.createdAt.toISO(),
    updatedAt: leave.updatedAt.toISO(),
  }
}

/** Detail and mutation responses: next approver and projected balance (07 §3.4, §3.7). */
export function leaveViewDto(view: LeaveView) {
  return {
    ...leaveDto(view.leave),
    approverId: view.approverId,
    balanceAfter: view.balanceAfter,
  }
}

export function leaveBalanceDto(balance: LeaveBalance) {
  return {
    employeeId: balance.employeeId,
    year: balance.year,
    leaveType: balance.leaveType,
    entitledDays: Number(balance.entitledDays),
    carriedOverDays: Number(balance.carriedOverDays),
    takenDays: Number(balance.takenDays),
    pendingDays: Number(balance.pendingDays),
    balance: displayedBalance(balance),
  }
}

export function holidayDto(holiday: PublicHoliday) {
  return {
    id: holiday.id,
    name: holiday.name,
    date: holiday.date.toISODate(),
    isMovable: holiday.isMovable,
    isRecurring: holiday.isRecurring,
  }
}
