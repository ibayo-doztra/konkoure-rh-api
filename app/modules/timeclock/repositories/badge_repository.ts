import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import NfcBadge from '#models/nfc_badge'
import NfcBadgeEvent from '#models/nfc_badge_event'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped NFC badges and their insert-only journal (02 §5). */
export class BadgeRepository extends TenantRepository<typeof NfcBadge> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(NfcBadge, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<NfcBadge>>) {
    return NfcBadge.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  /** The non-revoked badge of an employee, locked. */
  currentOfForUpdate(employeeId: string) {
    return this.query().where('employee_id', employeeId).whereNull('revoked_at').forUpdate().first()
  }

  currentOf(employeeId: string) {
    return this.query().where('employee_id', employeeId).whereNull('revoked_at').first()
  }

  /**
   * The non-revoked badge with this hash, in this organization only: a badge
   * of another organization is invisible (07 §2.3).
   */
  findByHash(uidHash: string) {
    return this.query().where('uid_hash', uidHash).whereNull('revoked_at').first()
  }

  record(entry: Partial<ModelAttributes<NfcBadgeEvent>>) {
    return NfcBadgeEvent.create(
      { ...entry, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  events(filters: { page: number; perPage: number; employeeId?: string }) {
    const query = NfcBadgeEvent.query({ client: this.trx }).where(
      'organization_id',
      this.organizationId
    )
    if (filters.employeeId) query.where('employee_id', filters.employeeId)
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }
}

export function badgesIn(organizationId: string, trx: TransactionClientContract) {
  return new BadgeRepository(organizationId, trx)
}
