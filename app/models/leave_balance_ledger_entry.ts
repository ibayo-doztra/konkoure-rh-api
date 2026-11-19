import { beforeCreate } from '@adonisjs/lucid/orm'
import { LeaveBalanceLedgerSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Immutable balance movement (02 §6): insert only. */
export default class LeaveBalanceLedgerEntry extends LeaveBalanceLedgerSchema {
  static table = 'leave_balance_ledger'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(leaveBalanceLedgerEntry: LeaveBalanceLedgerEntry) {
    leaveBalanceLedgerEntry.id ??= newId()
  }
}
