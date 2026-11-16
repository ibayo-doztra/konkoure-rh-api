import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuditLog from '#models/audit_log'

/** Who and where a mutation comes from (docs/backend/05 §7). */
export interface AuditContext {
  actorUserId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  organizationId?: string | null
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export interface AuditEntry {
  action: string
  targetType?: string | null
  targetId?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

const SENSITIVE_KEYS = /password|token|hash|secret|salary|national_?id|passport|uid/i

/** Replaces sensitive values by "[redacted]" before they reach the journal. */
function redact(data: Record<string, unknown> | null | undefined) {
  if (!data) return null
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[redacted]' : value,
    ])
  )
}

/**
 * Append-only audit trail. Must be called with the transaction of the mutation
 * it describes, so both commit or roll back together.
 */
export class AuditService {
  async record(trx: TransactionClientContract, context: AuditContext, entry: AuditEntry) {
    await AuditLog.create(
      {
        organizationId: context.organizationId ?? null,
        actorUserId: context.actorUserId ?? null,
        actorEmail: context.actorEmail ?? null,
        actorRole: context.actorRole ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        beforeData: redact(entry.before),
        afterData: redact(entry.after),
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        requestId: context.requestId ?? null,
      },
      { client: trx }
    )
  }
}

export default new AuditService()
