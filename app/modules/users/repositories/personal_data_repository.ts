import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Achievement from '#models/achievement'
import AttendanceDay from '#models/attendance_day'
import Contract from '#models/contract'
import Feedback from '#models/feedback'
import Goal from '#models/goal'
import LeaveBalance from '#models/leave_balance'
import LeaveBalanceLedgerEntry from '#models/leave_balance_ledger_entry'
import LeaveRequest from '#models/leave_request'
import NfcBadge from '#models/nfc_badge'
import Notification from '#models/notification'
import Okr from '#models/okr'
import OkrKeyResult from '#models/okr_key_result'
import PerformanceReview from '#models/performance_review'
import TimeLog from '#models/time_log'

/**
 * Reads of the personal data of one user in one organization, for the GDPR
 * export (docs/backend/05 §13). Every query is scoped by `organization_id`
 * and runs in the transaction opened by `withTenant()`.
 */
export class PersonalDataRepository {
  constructor(
    readonly organizationId: string,
    private readonly trx: TransactionClientContract
  ) {
    if (!organizationId) throw new Error('A tenant repository requires an organization id')
  }

  notifications(userId: string) {
    return Notification.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('user_id', userId)
      .orderBy('created_at', 'asc')
  }

  contracts(employeeId: string) {
    return Contract.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .whereNull('deleted_at')
      .orderBy('start_date', 'asc')
  }

  leaveRequests(employeeId: string) {
    return LeaveRequest.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy('start_date', 'asc')
  }

  leaveBalances(employeeId: string) {
    return LeaveBalance.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy([
        { column: 'year', order: 'asc' },
        { column: 'leave_type', order: 'asc' },
      ])
  }

  leaveLedger(employeeId: string) {
    return LeaveBalanceLedgerEntry.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy('created_at', 'asc')
  }

  timeLogs(employeeId: string) {
    return TimeLog.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy('punched_at', 'asc')
  }

  attendanceDays(employeeId: string) {
    return AttendanceDay.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy('day', 'asc')
  }

  badges(employeeId: string) {
    return NfcBadge.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy('assigned_at', 'asc')
  }

  reviews(employeeId: string) {
    return PerformanceReview.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .orderBy('created_at', 'asc')
  }

  goals(employeeId: string) {
    return Goal.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
  }

  okrs(employeeId: string) {
    return Okr.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
  }

  keyResults(okrIds: string[]) {
    if (okrIds.length === 0) return Promise.resolve([])
    return OkrKeyResult.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereIn('okr_id', okrIds)
      .orderBy('position', 'asc')
  }

  /** Feedback received and given; soft-deleted ones are left out. */
  feedbacks(employeeId: string) {
    return Feedback.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereNull('deleted_at')
      .where((query) =>
        query.where('to_employee_id', employeeId).orWhere('from_employee_id', employeeId)
      )
      .orderBy('created_at', 'asc')
  }

  achievements(employeeId: string) {
    return Achievement.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
  }
}

export function personalDataIn(organizationId: string, trx: TransactionClientContract) {
  return new PersonalDataRepository(organizationId, trx)
}
