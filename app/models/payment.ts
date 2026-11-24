import { beforeCreate } from '@adonisjs/lucid/orm'
import { PaymentSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type PaymentStatus = PaymentSchema['status']
export type PaymentMethod = NonNullable<PaymentSchema['method']>

/** Djomy payment (docs/backend/02 §9, 07 §7). Never serialized directly. */
export default class Payment extends PaymentSchema {
  static table = 'payments'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: Payment) {
    row.id ??= newId()
  }
}
