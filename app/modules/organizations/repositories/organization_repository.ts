import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Organization from '#models/organization'
import UserRole, { type AppRole } from '#models/user_role'

/**
 * Organization rows. Creation is the only operation that runs before a tenant
 * exists; every other access goes through the tenant-scoped repositories.
 */
export class OrganizationRepository {
  /** Ids of every live organization, for scheduled tasks that visit each tenant. */
  async activeIds(): Promise<string[]> {
    const rows = await Organization.query().whereNull('deleted_at').orderBy('id').select('id')
    return rows.map((row) => row.id)
  }

  /** The tenant root itself, excluding deleted organizations. */
  findActive(id: string, trx?: TransactionClientContract) {
    return Organization.query({ client: trx }).where('id', id).whereNull('deleted_at').first()
  }

  /** Locks the tenant root: serializes the changes of its settings and members. */
  findActiveForUpdate(id: string, trx: TransactionClientContract) {
    return Organization.query({ client: trx })
      .where('id', id)
      .whereNull('deleted_at')
      .forUpdate()
      .first()
  }

  save(organization: Organization, trx: TransactionClientContract) {
    organization.useTransaction(trx)
    return organization.save()
  }

  /** Taken slugs among `candidates`, deleted organizations included (slug is UNIQUE). */
  async takenSlugs(candidates: string[], trx: TransactionClientContract): Promise<Set<string>> {
    const rows = await Organization.query({ client: trx })
      .whereIn('slug', candidates)
      .select('slug')
    return new Set(rows.map((row) => row.slug))
  }

  create(
    data: Pick<Organization, 'id' | 'name' | 'slug' | 'defaultLanguage' | 'createdBy'> &
      Partial<Pick<Organization, 'performanceModel'>>,
    trx: TransactionClientContract
  ) {
    return Organization.create(data, { client: trx })
  }

  grantRole(
    data: { userId: string; organizationId: string; role: AppRole; grantedBy: string | null },
    trx: TransactionClientContract
  ) {
    return UserRole.create(data, { client: trx })
  }
}

export default new OrganizationRepository()
