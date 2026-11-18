import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Tenant transaction (docs/backend/05 §1): sets `app.org_id` for the residual
 * row-level security policies, scoped to this transaction only
 * (`set_config(..., true)` is the parameterizable form of `SET LOCAL`).
 */
export function withTenant<T>(
  organizationId: string,
  fn: (trx: TransactionClientContract) => Promise<T>
): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.rawQuery(`select set_config('app.org_id', ?, true)`, [organizationId])
    return fn(trx)
  })
}
