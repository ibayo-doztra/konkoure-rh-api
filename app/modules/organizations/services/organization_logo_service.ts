import { readFile } from 'node:fs/promises'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import type User from '#models/user'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import { detectImageType } from '#shared/utils/image_signature'
import organizations from '#modules/organizations/repositories/organization_repository'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Public bucket of organization logos (docs/backend/08 §6). */
const logoDisk = () => drive.use('s3Public')
const keyPrefix = (organizationId: string) => `${organizationId}/organization/${organizationId}/`

/** Logo of the current organization. Storage calls stay outside the transaction. */
export class OrganizationLogoService {
  async replace(
    tenant: TenantContext,
    actor: User,
    file: MultipartFile,
    audit: AuditContext
  ): Promise<Organization> {
    if (file.size > MAX_LOGO_BYTES) throw new AppException('E_PAYLOAD_TOO_LARGE')
    if (!file.tmpPath) throw new AppException('E_BAD_REQUEST')

    const content = await readFile(file.tmpPath)
    const type = detectImageType(content)
    if (!type) throw AppException.validation('logo', 'imageType', 'validation.organization.logo')

    const { organizationId } = tenant
    const key = `${keyPrefix(organizationId)}${newId()}.${type.extension}`
    let logoUrl: string
    try {
      await logoDisk().put(key, content, { contentType: type.mime, visibility: 'public' })
      logoUrl = await logoDisk().getUrl(key)
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }

    let previousUrl: string | null = null
    let organization: Organization
    try {
      organization = await withTenant(organizationId, async (trx) => {
        const locked = await organizations.findActiveForUpdate(organizationId, trx)
        if (!locked) throw new AppException('E_NOT_FOUND')
        previousUrl = locked.logoUrl
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
      await this.deleteQuietly(key)
      throw error
    }

    const previousKey = this.keyOf(organizationId, previousUrl)
    if (previousKey) await this.deleteQuietly(previousKey)
    return organization
  }

  /** Only files stored under this organization's own prefix are ever deleted. */
  private keyOf(organizationId: string, url: string | null) {
    const start = url?.indexOf(keyPrefix(organizationId)) ?? -1
    return url && start >= 0 ? url.slice(start).split('?')[0] : null
  }

  /** A leftover file is harmless: the request must not fail because of it. */
  private async deleteQuietly(key: string) {
    try {
      await logoDisk().delete(key)
    } catch (error) {
      logger.warn({ err: error, key }, 'organization logo cleanup failed')
    }
  }
}

export default new OrganizationLogoService()
