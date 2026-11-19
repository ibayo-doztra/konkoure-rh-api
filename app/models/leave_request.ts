import { beforeCreate } from '@adonisjs/lucid/orm'
import { LeaveRequestSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type LeaveType = LeaveRequestSchema['type']
export type LeaveStatus = LeaveRequestSchema['status']

/** Leave request (docs/backend/02 §6, 07 §3). Never serialized directly. */
export default class LeaveRequest extends LeaveRequestSchema {
  static table = 'leave_requests'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(leaveRequest: LeaveRequest) {
    leaveRequest.id ??= newId()
  }
}
