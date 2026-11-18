import { beforeCreate } from '@adonisjs/lucid/orm'
import { UserRoleSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type AppRole = UserRoleSchema['role']

/** A role held by a user in one organization (docs/backend/02 §3, 04 §4). */
export default class UserRole extends UserRoleSchema {
  static table = 'user_roles'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(role: UserRole) {
    role.id ??= newId()
  }
}
