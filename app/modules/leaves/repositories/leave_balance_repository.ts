import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import LeaveBalance from '#models/leave_balance'
import LeaveBalanceLedgerEntry from '#models/leave_balance_ledger_entry'
import type { LeaveType } from '#models/leave_request'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped balances and their insert-only ledger (docs/backend/02 §6). */
export class LeaveBalanceRepository extends TenantRepository<typeof LeaveBalance> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(LeaveBalance, organizationId, trx)
  }

  /** Callers hold the employee leave lock, so the row cannot appear meanwhile. */
  forUpdate(employeeId: string, year: number, leaveType: LeaveType) {
    return this.query()
      .where('employee_id', employeeId)
      .where('year', year)
      .where('leave_type', leaveType)
      .forUpdate()
      .first()
  }

  of(employeeId: string, year: number, leaveType: LeaveType) {
    return this.query()
      .where('employee_id', employeeId)
      .where('year', year)
      .where('leave_type', leaveType)
      .first()
  }

  create(data: Partial<ModelAttributes<LeaveBalance>>) {
    return LeaveBalance.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  /** Balances of a year, limited to live employee records. */
  list(year: number, employeeIds?: string[]) {
    const query = this.query()
      .where('year', year)
      .whereIn(
        'employee_id',
        this.trx
          .from('employees')
          .where('organization_id', this.organizationId)
          .whereNull('deleted_at')
          .select('id')
      )
    if (employeeIds) query.whereIn('employee_id', employeeIds)
    return query.orderBy('employee_id', 'asc').orderBy('leave_type', 'asc')
  }

  /** Annual balances of `year` of employees still employed (carry-over source). */
  annualOf(year: number) {
    return this.query()
      .where('year', year)
      .where('leave_type', 'annual')
      .whereIn(
        'employee_id',
        this.trx
          .from('employees')
          .where('organization_id', this.organizationId)
          .whereNull('deleted_at')
          .whereNot('status', 'terminated')
          .select('id')
      )
      .orderBy('employee_id', 'asc')
  }

  async hasEntry(employeeId: string, year: number, leaveType: LeaveType, reason: string) {
    const row = await LeaveBalanceLedgerEntry.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_id', employeeId)
      .where('year', year)
      .where('leave_type', leaveType)
      .where('reason', reason)
      .first()
    return row !== null
  }

  record(entry: Partial<ModelAttributes<LeaveBalanceLedgerEntry>>) {
    return LeaveBalanceLedgerEntry.create(
      { ...entry, organizationId: this.organizationId },
      { client: this.trx }
    )
  }
}

export function leaveBalancesIn(organizationId: string, trx: TransactionClientContract) {
  return new LeaveBalanceRepository(organizationId, trx)
}
