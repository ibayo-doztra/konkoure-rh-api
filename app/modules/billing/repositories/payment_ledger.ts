import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Payment from '#models/payment'
import { withTenant } from '#shared/tenant/with_tenant'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Payments across organizations, for the Djomy settlement and the scheduled
 * payment jobs only: the organization of a payment is not known before
 * reading it. The scheduled lists run in the worker, which bypasses RLS
 * (01 §4); mutations always run in the payment's tenant.
 */
export class PaymentLedger {
  /**
   * The payment of a merchant reference, read in its tenant: the organization
   * is resolved first (`payment_org_id_for_reference`, 0096), so RLS holds
   * for the application role too. A pre-signup payment is read outside any
   * tenant (07 §7.7).
   */
  async resolve(merchantReference: string) {
    if (!UUID.test(merchantReference)) return null
    const { rows } = await db.rawQuery('select payment_org_id_for_reference(?) as id', [
      merchantReference,
    ])
    const organizationId: string | null = rows[0]?.id ?? null
    if (!organizationId) return this.findByReference(merchantReference)
    return withTenant(organizationId, (trx) => this.findByReference(merchantReference, trx))
  }

  findByReference(merchantReference: string, trx?: TransactionClientContract) {
    return Payment.query({ client: trx }).where('merchant_reference', merchantReference).first()
  }

  findByReferenceForUpdate(merchantReference: string, trx: TransactionClientContract) {
    return Payment.query({ client: trx })
      .where('merchant_reference', merchantReference)
      .forUpdate()
      .first()
  }

  /** Pending payments created after `since`, with a Djomy transaction to check. */
  pendingSince(since: DateTime) {
    return Payment.query()
      .where('status', 'pending')
      .where('created_at', '>=', since.toJSDate())
      .whereNotNull('provider_transaction_id')
      .orderBy('created_at', 'asc')
  }

  /** Pending payments created before `before` (`payments:expire`). */
  pendingBefore(before: DateTime) {
    return Payment.query()
      .where('status', 'pending')
      .where('created_at', '<', before.toJSDate())
      .orderBy('created_at', 'asc')
  }

  /** Unsuccessful payments of the window, compared with Djomy (`payments:reconcile`). */
  unsuccessfulSince(since: DateTime) {
    return Payment.query()
      .whereIn('status', ['failed', 'expired'])
      .where('created_at', '>=', since.toJSDate())
      .whereNotNull('provider_transaction_id')
      .orderBy('created_at', 'asc')
  }
}

export default new PaymentLedger()
