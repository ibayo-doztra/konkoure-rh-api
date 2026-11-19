import { beforeCreate } from '@adonisjs/lucid/orm'
import { LeaveBalanceSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Balance of one employee, year and leave type (02 §6). Only moved with a ledger row. */
export default class LeaveBalance extends LeaveBalanceSchema {
  static table = 'leave_balances'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(leaveBalance: LeaveBalance) {
    leaveBalance.id ??= newId()
  }
}
