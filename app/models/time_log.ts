import { beforeCreate } from '@adonisjs/lucid/orm'
import { TimeLogSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type PunchType = TimeLogSchema['type']
export type PunchSource = TimeLogSchema['source']
export type PunchAnomaly = NonNullable<TimeLogSchema['anomaly']>

/** Punch (02 §5), partitioned by month on `punched_at`. Never serialized directly. */
export default class TimeLog extends TimeLogSchema {
  static table = 'time_logs'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: TimeLog) {
    row.id ??= newId()
  }
}
