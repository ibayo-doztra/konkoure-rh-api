import { beforeCreate } from '@adonisjs/lucid/orm'
import { WorkZoneSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Work zone (docs/backend/02 §5, 07 §2.1). */
export default class WorkZone extends WorkZoneSchema {
  static table = 'work_zones'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: WorkZone) {
    row.id ??= newId()
  }
}
