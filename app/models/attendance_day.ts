import { beforeCreate } from '@adonisjs/lucid/orm'
import { AttendanceDaySchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type AttendanceAnomaly = NonNullable<AttendanceDaySchema['anomaly']>

/** Daily attendance aggregate (02 §5, 07 §2.8), written by the attendance jobs only. */
export default class AttendanceDay extends AttendanceDaySchema {
  static table = 'attendance_days'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: AttendanceDay) {
    row.id ??= newId()
  }
}
