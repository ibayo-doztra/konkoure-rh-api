import { beforeCreate } from '@adonisjs/lucid/orm'
import { EmployeeSkillSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Competency held by an employee, level 1 to 5 (docs/backend/02 §4). */
export default class EmployeeSkill extends EmployeeSkillSchema {
  static table = 'employee_skills'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(employeeSkill: EmployeeSkill) {
    employeeSkill.id ??= newId()
  }
}
