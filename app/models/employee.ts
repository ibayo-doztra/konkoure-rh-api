import { beforeCreate } from '@adonisjs/lucid/orm'
import { EmployeeSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type EmployeeStatus = EmployeeSchema['status']

/**
 * HR record (docs/backend/02 §4). Never serialized directly: the DTOs of
 * `employee_transformer` decide which fields each viewer receives.
 */
export default class Employee extends EmployeeSchema {
  static table = 'employees'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(employee: Employee) {
    employee.id ??= newId()
  }
}
