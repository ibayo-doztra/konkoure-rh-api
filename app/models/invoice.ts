import { beforeCreate } from '@adonisjs/lucid/orm'
import { InvoiceSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Invoice of a paid period (docs/backend/02 §9). Never serialized directly. */
export default class Invoice extends InvoiceSchema {
  static table = 'invoices'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(row: Invoice) {
    row.id ??= newId()
  }
}
