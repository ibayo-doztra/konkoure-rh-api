import { DateTime } from 'luxon'
import Payment from '#models/payment'
import type { PaymentStatus } from '#models/payment'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { decodeCursor, encodeCursor } from '#shared/pagination/cursor'
import { platformClient } from '#shared/platform/platform_client'
import { withTenant } from '#shared/tenant/with_tenant'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import healthService from '#modules/health/services/health_service'
import djomyClient from '#modules/billing/services/djomy_client'
import aiService from '#modules/integrations/services/ai_service'
import settlementService from '#modules/billing/services/settlement_service'
import ledger from '#modules/billing/repositories/payment_ledger'
import { paymentsIn } from '#modules/billing/repositories/payment_repository'
import { queueDriver } from '#shared/queue/queue_service'

/** Journal pages (06 §13): cursor pagination, 500 rows at most. */
export const MAX_LOG_PAGE = 500
const DEFAULT_LOG_PAGE = 100

export type LogKind = 'audit' | 'system' | 'usage'

export interface LogFilters {
  cursor?: string
  limit?: number
  organizationId?: string
  from?: DateTime
  to?: DateTime
  actorUserId?: string
  action?: string
  channel?: string
  level?: string
  module?: string
}

const TABLES: Record<LogKind, string> = {
  audit: 'audit_logs',
  system: 'system_logs',
  usage: 'usage_events',
}

/**
 * @platformScope — back-office operations across organizations (06 §13):
 * payments and their manual reconciliation, journals, health.
 */
export class PlatformOperationsService {
  /** `GET /platform/payments`: every payment, pre-signup ones included. */
  payments(filters: {
    page: number
    perPage: number
    status?: PaymentStatus
    failureReason?: string
    organizationId?: string
  }) {
    const query = Payment.query({ client: platformClient() })
    if (filters.status) query.where('status', filters.status)
    if (filters.failureReason) query.where('failure_reason', filters.failureReason)
    if (filters.organizationId) query.where('organization_id', filters.organizationId)
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }

  /**
   * `POST /platform/payments/:id/reconcile` (root, 07 §7.8): Djomy is asked
   * again; a payment it reports paid in full is settled like a confirmed one
   * (activation, invoice, e-mail), even if it had failed or expired here.
   * Idempotent: a succeeded payment is returned as is.
   */
  async reconcile(actor: User, id: string, audit: AuditContext) {
    const found = await Payment.query({ client: platformClient() }).where('id', id).first()
    if (!found) throw new AppException('E_NOT_FOUND')
    if (found.status === 'succeeded') return { payment: found, outcome: 'already_settled' }
    if (!found.providerTransactionId) {
      throw new AppException('E_CONFLICT', {
        details: [
          { field: 'id', rule: 'noTransaction', message: 'validation.platform.noTransaction' },
        ],
      })
    }
    const remote = await djomyClient.status(found.providerTransactionId)
    if (remote.status !== 'succeeded') {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'id', rule: 'notPaid', message: 'validation.platform.notPaid' }],
      })
    }

    // Back to `pending`, so the regular settlement applies the verified result once.
    const reopen = async (trx: TransactionClientContract, payment: Payment) => {
      const before = { status: payment.status, failureReason: payment.failureReason }
      payment.merge({ status: 'pending', failureReason: null })
      await payment.useTransaction(trx).save()
      await auditService.record(
        trx,
        {
          ...audit,
          organizationId: payment.organizationId,
          actorUserId: actor.id,
          actorRole: 'platform_root',
        },
        { action: 'payment.reconciled', targetType: 'payment', targetId: payment.id, before }
      )
    }
    if (found.organizationId) {
      const organizationId = found.organizationId
      await withTenant(organizationId, async (trx) => {
        const payment = await paymentsIn(organizationId, trx).findForUpdate(id)
        if (payment && payment.status !== 'succeeded') await reopen(trx, payment)
      })
    } else {
      await db.transaction(async (trx) => {
        const payment = await ledger.findByReferenceForUpdate(found.merchantReference, trx)
        if (payment && payment.status !== 'succeeded') await reopen(trx, payment)
      })
    }
    const outcome = await settlementService.settle(found.merchantReference)
    const payment = await Payment.query({ client: platformClient() }).where('id', id).firstOrFail()
    return { payment, outcome }
  }

  /** `GET /platform/logs/:kind`: newest first, cursor `(created_at, id)`. */
  async logs(kind: LogKind, filters: LogFilters) {
    const limit = Math.min(filters.limit ?? DEFAULT_LOG_PAGE, MAX_LOG_PAGE)
    const query = platformClient().from(TABLES[kind])
    if (filters.organizationId) query.where('organization_id', filters.organizationId)
    if (filters.from) query.where('created_at', '>=', filters.from.toJSDate())
    if (filters.to) query.where('created_at', '<', filters.to.toJSDate())
    if (kind === 'audit') {
      if (filters.actorUserId) query.where('actor_user_id', filters.actorUserId)
      if (filters.action) query.where('action', filters.action)
    }
    if (kind === 'system') {
      if (filters.channel) query.where('channel', filters.channel)
      if (filters.level) query.where('level', filters.level)
    }
    if (kind === 'usage' && filters.module) query.where('module', filters.module)
    if (filters.cursor) {
      const cursor = decodeCursor(filters.cursor)
      query.whereRaw('(created_at, id) < (?, ?)', [cursor.createdAt, cursor.id])
    }
    const rows: Array<Record<string, unknown> & { id: string; created_at: Date }> = await query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .select('*')
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      rows: page,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor(DateTime.fromJSDate(new Date(last.created_at)), last.id)
          : null,
    }
  }

  /** `GET /platform/health`: probes of `/health/ready` plus queues and integrations. */
  async health() {
    const { ready, body } = await healthService.readiness()
    return {
      ...body,
      ready,
      queue: { driver: queueDriver },
      integrations: {
        djomy: djomyClient.configured ? 'configured' : 'missing',
        ai: aiService.configured ? 'configured' : 'missing',
      },
      checkedAt: DateTime.now().toUTC().toISO(),
    }
  }
}

export default new PlatformOperationsService()
