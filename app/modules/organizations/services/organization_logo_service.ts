import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type User from '#models/user'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import fileStorage from '#shared/files/file_storage'
import { filesIn } from '#shared/files/file_repository'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { detectImageType } from '#shared/utils/image_signature'
import organizations from '#modules/organizations/repositories/organization_repository'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** `files.owner_type` of organization logos (`owner_id` = the organization). */
export const LOGO_OWNER = 'organization_logo'

const keyPrefix = (organizationId: string) => `${organizationId}/organization/${organizationId}/`

/**
 * Logo of the current organization, in the public bucket (docs/backend/08 §6),
 * recorded in the `files` registry. Storage calls stay outside the transaction.
 */
export class OrganizationLogoService {
  async replace(
    tenant: TenantContext,
    actor: User,
    file: MultipartFile,
    audit: AuditContext
  ): Promise<Organization> {
    const { organizationId } = tenant
    const upload = await fileStorage.check(file, MAX_LOGO_BYTES, detectImageType, () =>
      AppException.validation('logo', 'imageType', 'validation.organization.logo')
    )
    const key = fileStorage.key(
      organizationId,
      'organization',
      organizationId,
      upload.type.extension
    )
    const stored = await fileStorage.put('public', key, upload)

    let previous: string[] = []
    let organization: Organization
    try {
      const logoUrl = await fileStorage.publicUrl(key)
      organization = await withTenant(organizationId, async (trx) => {
        const files = filesIn(organizationId, trx)
        const locked = await organizations.findActiveForUpdate(organizationId, trx)
        if (!locked) throw new AppException('E_NOT_FOUND')
        const previousUrl = locked.logoUrl
        const rows = await files.ownedBy(LOGO_OWNER, organizationId)
        const registered = rows.map((row) => row.path)
        // A logo stored before the registry only exists through its URL.
        const legacy = this.keyOf(organizationId, previousUrl)
        previous = [...new Set(legacy ? [...registered, legacy] : registered)]
        await files.forgetPaths(registered)
        await files.create({
          ...stored,
          ownerType: LOGO_OWNER,
          ownerId: organizationId,
          uploadedBy: actor.id,
        })
        locked.merge({ logoUrl, updatedBy: actor.id })
        await organizations.save(locked, trx)
        await auditService.record(
          trx,
          { ...audit, organizationId, actorRole: tenant.primaryRole },
          {
            action: 'organization.logo_updated',
            targetType: 'organization',
            targetId: organizationId,
            before: { logoUrl: previousUrl },
            after: { logoUrl },
          }
        )
        await locked.refresh()
        return locked
      })
    } catch (error) {
      await fileStorage.deleteQuietly('public', key)
      throw error
    }

    for (const path of previous) await fileStorage.deleteQuietly('public', path)
    return organization
  }

  /** Only files stored under this organization's own prefix are ever deleted. */
  private keyOf(organizationId: string, url: string | null) {
    const start = url?.indexOf(keyPrefix(organizationId)) ?? -1
    return url && start >= 0 ? url.slice(start).split('?')[0] : null
  }
}

export default new OrganizationLogoService()
