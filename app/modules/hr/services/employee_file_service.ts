import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type User from '#models/user'
import type Employee from '#models/employee'
import type StoredFile from '#models/stored_file'
import type { FileCategory } from '#models/stored_file'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { filesIn } from '#shared/files/file_repository'
import fileStorage from '#shared/files/file_storage'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { detectDocumentType } from '#shared/utils/document_signature'
import { detectImageType } from '#shared/utils/image_signature'
import { employeesIn } from '#modules/hr/repositories/employee_repository'

/** Documents up to 10 MB, photos up to 2 MB like logos (docs/backend/05 §3). */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

const DOCUMENT_OWNER = 'employee'
const PHOTO_OWNER = 'employee_photo'

/** Original name reduced to a readable title: no path, no control characters. */
function cleanName(raw: string | undefined | null) {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? ''
  const title = base
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/[\p{C}<>"]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return title.length >= 2 ? title : null
}

/** Employee documents and photo (docs/backend/06 §4). Storage stays out of transactions. */
export class EmployeeFileService {
  documents(tenant: TenantContext, employeeId: string): Promise<StoredFile[]> {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) =>
      filesIn(organizationId, trx).ownedBy(DOCUMENT_OWNER, employeeId)
    )
  }

  async addDocument(
    tenant: TenantContext,
    actor: User,
    employee: Employee,
    input: { file: MultipartFile; category: FileCategory; name?: string },
    audit: AuditContext
  ): Promise<StoredFile> {
    const { organizationId } = tenant
    const upload = await fileStorage.check(input.file, MAX_DOCUMENT_BYTES, detectDocumentType, () =>
      AppException.validation('file', 'documentType', 'validation.employee.documentType')
    )
    const key = fileStorage.key(organizationId, 'employee', employee.id, upload.type.extension)
    const stored = await fileStorage.put('private', key, upload)
    try {
      return await withTenant(organizationId, async (trx) => {
        if (!(await employeesIn(organizationId, trx).find(employee.id))) {
          throw new AppException('E_NOT_FOUND')
        }
        const document = await filesIn(organizationId, trx).create({
          ...stored,
          ownerType: DOCUMENT_OWNER,
          ownerId: employee.id,
          category: input.category,
          name: input.name ?? cleanName(input.file.clientName) ?? input.category,
          uploadedBy: actor.id,
        })
        await auditService.record(trx, this.context(tenant, audit), {
          action: 'employee.document_added',
          targetType: 'employee',
          targetId: employee.id,
          after: { documentId: document.id, category: input.category, mime: stored.mime },
        })
        await document.refresh()
        return document
      })
    } catch (error) {
      await fileStorage.deleteQuietly('private', key)
      throw error
    }
  }

  find(tenant: TenantContext, employeeId: string, documentId: string): Promise<StoredFile> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const document = await filesIn(organizationId, trx).findOwned(
        DOCUMENT_OWNER,
        employeeId,
        documentId
      )
      if (!document) throw new AppException('E_NOT_FOUND')
      return document
    })
  }

  /** Short-lived signed link, journaled (05 §7). */
  async documentUrl(tenant: TenantContext, document: StoredFile, audit: AuditContext) {
    await withTenant(tenant.organizationId, (trx) =>
      auditService.record(trx, this.context(tenant, audit), {
        action: 'sensitive_document.viewed',
        targetType: 'employee',
        targetId: document.ownerId,
        after: { documentId: document.id },
      })
    )
    return fileStorage.signedUrl(document.path)
  }

  async removeDocument(
    tenant: TenantContext,
    employeeId: string,
    documentId: string,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    const path = await withTenant(organizationId, async (trx) => {
      const files = filesIn(organizationId, trx)
      const document = await files.findOwnedForUpdate(DOCUMENT_OWNER, employeeId, documentId)
      if (!document) throw new AppException('E_NOT_FOUND')
      await files.remove(document)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'employee.document_deleted',
        targetType: 'employee',
        targetId: employeeId,
        before: { documentId, category: document.category },
      })
      return document.path
    })
    await fileStorage.deleteQuietly('private', path)
  }

  /** Public photo, like the organization logo; the previous one is deleted after commit. */
  async replacePhoto(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    file: MultipartFile,
    audit: AuditContext
  ): Promise<Employee> {
    const { organizationId } = tenant
    const upload = await fileStorage.check(file, MAX_PHOTO_BYTES, detectImageType, () =>
      AppException.validation('file', 'imageType', 'validation.employee.photoType')
    )
    const key = fileStorage.key(organizationId, 'employee_photo', employeeId, upload.type.extension)
    const stored = await fileStorage.put('public', key, upload)
    const photoUrl = await fileStorage.publicUrl(key)

    let previous: string[] = []
    let employee: Employee
    try {
      employee = await withTenant(organizationId, async (trx) => {
        const employees = employeesIn(organizationId, trx)
        const files = filesIn(organizationId, trx)
        const locked = await employees.findForUpdate(employeeId)
        if (!locked) throw new AppException('E_NOT_FOUND')
        const photos = await files.ownedBy(PHOTO_OWNER, employeeId)
        previous = photos.map((row) => row.path)
        await files.forgetPaths(previous)
        await files.create({
          ...stored,
          ownerType: PHOTO_OWNER,
          ownerId: employeeId,
          uploadedBy: actor.id,
        })
        locked.merge({ photoUrl, updatedBy: actor.id })
        await employees.save(locked)
        await auditService.record(trx, this.context(tenant, audit), {
          action: 'employee.photo_updated',
          targetType: 'employee',
          targetId: employeeId,
          after: { photoUrl },
        })
        await locked.refresh()
        return locked
      })
    } catch (error) {
      await fileStorage.deleteQuietly('public', key)
      throw error
    }
    for (const path of previous) await fileStorage.deleteQuietly('public', path)
    return employee
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new EmployeeFileService()
