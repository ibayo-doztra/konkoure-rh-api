import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import DeviceToken from '#models/device_token'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped kiosk tokens (05 §6). */
export class DeviceTokenRepository extends TenantRepository<typeof DeviceToken> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(DeviceToken, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<DeviceToken>>) {
    return DeviceToken.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  all() {
    return this.query().orderBy('created_at', 'desc').orderBy('id', 'desc')
  }

  /** A usable token of this organization. */
  usable(tokenHash: string) {
    return this.query()
      .where('token_hash', tokenHash)
      .whereNull('revoked_at')
      .where('expires_at', '>', new Date())
      .first()
  }
}

export function deviceTokensIn(organizationId: string, trx: TransactionClientContract) {
  return new DeviceTokenRepository(organizationId, trx)
}

/**
 * Organization of a usable token, before any tenant is known: a definer
 * function reads it under the application role (0045).
 */
export async function organizationOfDeviceToken(tokenHash: string): Promise<string | null> {
  const result = await db.rawQuery('select device_token_org_id(?) as id', [tokenHash])
  return (result.rows[0]?.id as string | null) ?? null
}
