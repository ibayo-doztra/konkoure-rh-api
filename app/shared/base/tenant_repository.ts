import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { AppException } from '#shared/exceptions/app_exception'

/**
 * Base of every tenant repository (docs/backend/03 §5, 05 §1): it cannot exist
 * without an organization and the transaction opened by `withTenant()`, so each
 * query carries both the application scope and the RLS context.
 */
export abstract class TenantRepository<Model extends LucidModel> {
  /** Set by repositories of soft-deleted entities. */
  protected readonly softDeletes: boolean = false

  constructor(
    protected readonly model: Model,
    readonly organizationId: string,
    protected readonly trx: TransactionClientContract
  ) {
    if (!organizationId) throw new Error('A tenant repository requires an organization id')
  }

  protected query() {
    const query = this.model
      .query({ client: this.trx })
      .where('organization_id', this.organizationId)
    return this.softDeletes ? query.whereNull('deleted_at') : query
  }

  find(id: string): Promise<InstanceType<Model> | null> {
    return this.query().where('id', id).first() as Promise<InstanceType<Model> | null>
  }

  /** A row of another organization is indistinguishable from a missing one: 404. */
  async findOrFail(id: string): Promise<InstanceType<Model>> {
    const row = await this.find(id)
    if (!row) throw new AppException('E_NOT_FOUND')
    return row
  }

  findForUpdate(id: string): Promise<InstanceType<Model> | null> {
    return this.query().where('id', id).forUpdate().first() as Promise<InstanceType<Model> | null>
  }

  save<Row extends LucidRow>(row: Row): Promise<Row> {
    row.useTransaction(this.trx)
    return row.save() as Promise<Row>
  }
}
