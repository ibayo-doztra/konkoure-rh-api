import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import WorkZone from '#models/work_zone'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped work zones; deleted zones stay referenced by past punches. */
export class WorkZoneRepository extends TenantRepository<typeof WorkZone> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(WorkZone, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<WorkZone>>) {
    return WorkZone.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  all() {
    return this.query().orderBy('name', 'asc').orderBy('id', 'asc')
  }

  active() {
    return this.query().where('is_active', true)
  }

  async nameTaken(name: string, exceptId?: string) {
    const query = this.query().whereRaw('lower(name) = lower(?)', [name])
    if (exceptId) query.whereNot('id', exceptId)
    return (await query.first()) !== null
  }
}

export function workZonesIn(organizationId: string, trx: TransactionClientContract) {
  return new WorkZoneRepository(organizationId, trx)
}
