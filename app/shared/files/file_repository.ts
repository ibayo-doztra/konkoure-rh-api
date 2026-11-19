import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import StoredFile from '#models/stored_file'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped rows of the `files` registry. */
export class FileRepository extends TenantRepository<typeof StoredFile> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(StoredFile, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<StoredFile>>) {
    return StoredFile.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  ownedBy(ownerType: string, ownerId: string) {
    return this.query()
      .where('owner_type', ownerType)
      .where('owner_id', ownerId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
  }

  findOwned(ownerType: string, ownerId: string, id: string) {
    return this.ownedBy(ownerType, ownerId).where('id', id).first()
  }

  findOwnedForUpdate(ownerType: string, ownerId: string, id: string) {
    return this.ownedBy(ownerType, ownerId).where('id', id).forUpdate().first()
  }

  /** Forgets the registry rows of replaced files (the objects are deleted after commit). */
  async forgetPaths(paths: string[]) {
    if (paths.length === 0) return
    await this.query().whereIn('path', paths).delete()
  }

  async remove(file: StoredFile) {
    file.useTransaction(this.trx)
    await file.delete()
  }
}

export function filesIn(organizationId: string, trx: TransactionClientContract) {
  return new FileRepository(organizationId, trx)
}
