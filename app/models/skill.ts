import { beforeCreate } from '@adonisjs/lucid/orm'
import { SkillSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Entry of the organization's competency catalog (docs/backend/02 §4). */
export default class Skill extends SkillSchema {
  static table = 'skills'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(skill: Skill) {
    skill.id ??= newId()
  }
}
