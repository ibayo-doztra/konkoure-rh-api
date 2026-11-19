import { DateTime } from 'luxon'
import type User from '#models/user'
import type DeviceToken from '#models/device_token'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { randomToken, sha256 } from '#shared/utils/crypto'
import {
  deviceTokensIn,
  organizationOfDeviceToken,
} from '#modules/timeclock/repositories/device_token_repository'

/** Prefix that routes a bearer token to the kiosk authentication. */
export const DEVICE_TOKEN_PREFIX = 'kd_'
/** A kiosk token lives 90 days unless told otherwise (decision of 2026-11-19). */
const DEFAULT_DAYS = 90

/** Kiosk tokens (docs/backend/05 §6): `timeclock:scan` only, limited in time, revocable. */
export class DeviceTokenService {
  /** The clear token is returned once, never stored. */
  async create(
    tenant: TenantContext,
    actor: User,
    input: { name: string; expiresInDays?: number },
    audit: AuditContext
  ): Promise<{ device: DeviceToken; token: string }> {
    const { organizationId } = tenant
    const token = randomToken(32, DEVICE_TOKEN_PREFIX)
    const device = await withTenant(organizationId, async (trx) => {
      const created = await deviceTokensIn(organizationId, trx).create({
        name: input.name,
        tokenHash: sha256(token),
        expiresAt: DateTime.now().plus({ days: input.expiresInDays ?? DEFAULT_DAYS }),
        createdBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'device_token.created',
        targetType: 'device_token',
        targetId: created.id,
        after: { name: input.name, expiresAt: created.expiresAt.toISO() },
      })
      await created.refresh()
      return created
    })
    return { device, token }
  }

  list(tenant: TenantContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => deviceTokensIn(organizationId, trx).all())
  }

  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => deviceTokensIn(organizationId, trx).findOrFail(id))
  }

  async revoke(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const tokens = deviceTokensIn(organizationId, trx)
      const device = await tokens.findForUpdate(id)
      if (!device) throw new AppException('E_NOT_FOUND')
      if (device.revokedAt) return
      device.merge({ revokedAt: DateTime.now() })
      await tokens.save(device)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'device_token.revoked',
        targetType: 'device_token',
        targetId: id,
      })
    })
  }

  /** Resolves a presented kiosk token, or null; records its last use. */
  async authenticate(token: string): Promise<DeviceToken | null> {
    if (!token.startsWith(DEVICE_TOKEN_PREFIX)) return null
    const hash = sha256(token)
    const organizationId = await organizationOfDeviceToken(hash)
    if (!organizationId) return null
    return withTenant(organizationId, async (trx) => {
      const tokens = deviceTokensIn(organizationId, trx)
      const device = await tokens.usable(hash)
      if (!device) return null
      const stale = !device.lastUsedAt || device.lastUsedAt < DateTime.now().minus({ minutes: 5 })
      if (stale) {
        device.merge({ lastUsedAt: DateTime.now() })
        await tokens.save(device)
      }
      return device
    })
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new DeviceTokenService()
