import { beforeCreate } from '@adonisjs/lucid/orm'
import { PlatformAdminSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Back-office administrator, outside any tenant (docs/backend/04 §4). */
export default class PlatformAdmin extends PlatformAdminSchema {
  static table = 'platform_admins'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(admin: PlatformAdmin) {
    admin.id ??= newId()
  }
}
