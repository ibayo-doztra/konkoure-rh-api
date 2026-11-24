import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Invoice from '#models/invoice'
import Payment, { type PaymentStatus } from '#models/payment'
import UsageCounter from '#models/usage_counter'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Payments of one organization (pre-signup payments are not tenant data yet). */
export class PaymentRepository extends TenantRepository<typeof Payment> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Payment, organizationId, trx)
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
