import { DateTime } from 'luxon'
import type User from '#models/user'
import type WorkZone from '#models/work_zone'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { workZonesIn } from '#modules/timeclock/repositories/work_zone_repository'
import { polygonProblem, type Ring } from '#modules/timeclock/timeclock_rules'

export interface ZoneInput {
  name?: string
  shape?: 'circle' | 'polygon'
  latitude?: number | null
  longitude?: number | null
  radiusMeters?: number | null
  polygon?: Ring | null
  isActive?: boolean
  timezone?: string | null
}

const invalid = (field: string, rule: string) =>
  AppException.validation(field, rule, `validation.timeclock.${rule}`)

/** Work zones (docs/backend/06 §6, 07 §2.1). */
export class ZoneService {
  list(tenant: TenantContext): Promise<WorkZone[]> {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => workZonesIn(organizationId, trx).all())
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: ZoneInput & { name: string },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const zones = workZonesIn(organizationId, trx)
      if (await zones.nameTaken(input.name)) throw this.nameTaken()
      const shape = input.shape ?? 'circle'
      const fields = this.geometry(shape, input)
      const zone = await zones.create({
        name: input.name,
        shape,
        ...fields,
        isActive: input.isActive ?? true,
        timezone: input.timezone ?? null,
        createdBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'work_zone.created',
        targetType: 'work_zone',
        targetId: zone.id,
        after: { name: zone.name, shape },
      })
      await zone.refresh()
      return zone
    })
  }

  update(tenant: TenantContext, id: string, input: ZoneInput, audit: AuditContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const zones = workZonesIn(organizationId, trx)
      const zone = await zones.findForUpdate(id)
      if (!zone) throw new AppException('E_NOT_FOUND')
      if (input.name && (await zones.nameTaken(input.name, id))) throw this.nameTaken()

      const shape = input.shape ?? zone.shape
      const geometry = this.geometry(shape, {
        latitude: input.latitude === undefined ? zone.latitude : input.latitude,
        longitude: input.longitude === undefined ? zone.longitude : input.longitude,
        radiusMeters: input.radiusMeters === undefined ? zone.radiusMeters : input.radiusMeters,
        polygon:
          input.polygon === undefined ? (zone.polygon?.coordinates[0] ?? null) : input.polygon,
      })
      const before = { name: zone.name, shape: zone.shape, isActive: zone.isActive }
      zone.merge({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        shape,
        ...geometry,
      })
      await zones.save(zone)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'work_zone.updated',
        targetType: 'work_zone',
        targetId: id,
        before,
        after: { name: zone.name, shape: zone.shape, isActive: zone.isActive },
      })
      await zone.refresh()
      return zone
    })
  }

  /** Soft delete: past punches keep their zone. */
  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const zones = workZonesIn(organizationId, trx)
      const zone = await zones.findForUpdate(id)
      if (!zone) throw new AppException('E_NOT_FOUND')
      zone.merge({ deletedAt: DateTime.now(), isActive: false })
      await zones.save(zone)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'work_zone.deleted',
        targetType: 'work_zone',
        targetId: id,
        before: { name: zone.name },
      })
    })
  }

  /** Columns of a circle or a polygon (07 §2.1); the other shape's columns are cleared. */
  private geometry(shape: 'circle' | 'polygon', input: ZoneInput) {
    if (shape === 'circle') {
      const { latitude, longitude, radiusMeters } = input
      const missing = (value: number | null | undefined) => value === null || value === undefined
      if (missing(latitude) || missing(longitude) || missing(radiusMeters)) {
        throw invalid('latitude', 'circle')
      }
      return {
        latitude: latitude!,
        longitude: longitude!,
        radiusMeters: radiusMeters!,
        polygon: null,
      }
    }
    if (!input.polygon) throw invalid('polygon', 'polygon')
    const problem = polygonProblem(input.polygon)
    if (problem) throw invalid('polygon', problem)
    return {
      latitude: null,
      longitude: null,
      radiusMeters: null,
      polygon: { type: 'Polygon' as const, coordinates: [input.polygon] },
    }
  }

  private nameTaken() {
    return new AppException('E_CONFLICT', {
      details: [{ field: 'name', rule: 'unique', message: 'validation.timeclock.zoneName' }],
    })
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new ZoneService()
