import db from '@adonisjs/lucid/services/db'
import WebhookReceipt from '#models/webhook_receipt'
import { newId } from '#shared/utils/crypto'

/**
 * Inbound webhook journal (05 §11), outside any tenant: the provider's event
 * id is recorded once, a replay is recognized by `UNIQUE(provider, event_id)`.
 */
export class ReceiptRepository {
  /** The new receipt id, or `null` when the event was already received. */
  async record(provider: string, eventId: string, payload: unknown): Promise<string | null> {
    const rows: Array<{ id: string }> = await db
      .table('webhook_receipts')
      .insert({
        id: newId(),
        provider,
        event_id: eventId,
        signature_valid: true,
        payload: JSON.stringify(payload),
      })
      .onConflict(['provider', 'event_id'])
      .ignore()
      .returning('id')
    return rows[0]?.id ?? null
  }

  find(id: string) {
    return WebhookReceipt.find(id)
  }

  save(receipt: WebhookReceipt) {
    return receipt.save()
  }
}

export default new ReceiptRepository()
