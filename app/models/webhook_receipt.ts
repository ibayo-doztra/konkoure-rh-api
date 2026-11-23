import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { WebhookReceiptSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Inbound webhook event (05 §11), outside any tenant. Never serialized directly. */
export default class WebhookReceipt extends WebhookReceiptSchema {
  static table = 'webhook_receipts'
  static selfAssignPrimaryKey = true

  /** Any JSON value, arrays included, written as jsonb. */
  @column({ prepare: (value: unknown) => JSON.stringify(value) })
  declare payload: unknown

  @beforeCreate()
  static assignId(receipt: WebhookReceipt) {
    receipt.id ??= newId()
  }
}
