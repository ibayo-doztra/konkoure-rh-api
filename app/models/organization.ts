import { beforeCreate } from '@adonisjs/lucid/orm'
import { OrganizationSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Tenant root (docs/backend/02 §3). */
export default class Organization extends OrganizationSchema {
  static table = 'organizations'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(organization: Organization) {
    organization.id ??= newId()
  }
}
