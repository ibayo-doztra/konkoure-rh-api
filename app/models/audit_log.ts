import { beforeCreate } from '@adonisjs/lucid/orm'
import { AuditLogSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Append-only audit entry (docs/backend/05 §7). Written by AuditService only. */
export default class AuditLog extends AuditLogSchema {
  static table = 'audit_logs'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(entry: AuditLog) {
    entry.id ??= newId()
  }
}
