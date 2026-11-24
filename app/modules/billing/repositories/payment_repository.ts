import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Invoice from '#models/invoice'
import Payment, { type PaymentStatus } from '#models/payment'
import UsageCounter from '#models/usage_counter'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Payments of one organization (pre-signup payments are not tenant data yet). */
export class PaymentRepository extends TenantRepository<typeof Payment> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Payment, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<Payment>>) {
    return Payment.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: { page: number; perPage: number; status?: PaymentStatus }) {
    const query = this.query()
    if (filters.status) query.where('status', filters.status)
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }
}

/** Invoices of one organization. */
export class InvoiceRepository extends TenantRepository<typeof Invoice> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Invoice, organizationId, trx)
  }

  /** `KNK-AAAA-NNNNNN` from the global sequence (02 §9). */
  async create(data: {
    subscriptionId: string
    paymentId: string
    amount: number
    issuedAt: DateTime
    periodStart: DateTime
    periodEnd: DateTime
  }) {
    const { rows } = await this.trx.rawQuery("SELECT nextval('invoice_number_seq') AS value")
    const sequence = String(rows[0].value).padStart(6, '0')
    return Invoice.create(
      {
        organizationId: this.organizationId,
        subscriptionId: data.subscriptionId,
        paymentId: data.paymentId,
        number: `KNK-${data.issuedAt.toUTC().year}-${sequence}`,
        amount: String(data.amount),
        issuedAt: data.issuedAt,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
      { client: this.trx }
    )
  }

  paginate(filters: { page: number; perPage: number }) {
    return this.query()
      .orderBy('issued_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }
}

/** Monthly usage counters of one organization. */
export class UsageCounterRepository extends TenantRepository<typeof UsageCounter> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(UsageCounter, organizationId, trx)
  }

  ofPeriod(period: string) {
    return this.query().where('period', period)
  }
}

export function paymentsIn(organizationId: string, trx: TransactionClientContract) {
  return new PaymentRepository(organizationId, trx)
}

export function invoicesIn(organizationId: string, trx: TransactionClientContract) {
  return new InvoiceRepository(organizationId, trx)
}

export function usageCountersIn(organizationId: string, trx: TransactionClientContract) {
  return new UsageCounterRepository(organizationId, trx)
}
