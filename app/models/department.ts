import { beforeCreate } from '@adonisjs/lucid/orm'
import { DepartmentSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Organizational unit (docs/backend/02 §4). */
export default class Department extends DepartmentSchema {
  static table = 'departments'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(department: Department) {
    department.id ??= newId()
  }
}
