import { beforeCreate } from '@adonisjs/lucid/orm'
import { WorkScheduleSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Work schedule (docs/backend/02 §6): organization template or an employee's own. */
export default class WorkSchedule extends WorkScheduleSchema {
  static table = 'work_schedules'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: WorkSchedule) {
    row.id ??= newId()
  }
}
