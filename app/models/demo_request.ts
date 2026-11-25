import { beforeCreate } from '@adonisjs/lucid/orm'
import { DemoRequestSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Demo request from the public site (docs/backend/02 §10). Never serialized directly. */
export default class DemoRequest extends DemoRequestSchema {
  static table = 'demo_requests'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: DemoRequest) {
    row.id ??= newId()
  }
}
