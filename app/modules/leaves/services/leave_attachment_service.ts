import { readFile } from 'node:fs/promises'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import type LeaveRequest from '#models/leave_request'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import { detectDocumentType } from '#shared/utils/document_signature'
import { leaveRequestsIn } from '#modules/leaves/repositories/leave_request_repository'

/** Documents are limited to 10 MB (docs/backend/05 §3). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
/** Signed links to private documents last 15 minutes (08 §6). */
const ATTACHMENT_URL_TTL_SECONDS = 15 * 60

/** Private bucket (`private-docs`, 08 §6). */
const privateDisk = () => drive.use('s3')
const keyPrefix = (organizationId: string, leaveId: string) =>
  `${organizationId}/leave_request/${leaveId}/`

/** Supporting document of a leave. Storage calls stay outside the transaction. */
export class LeaveAttachmentService {
  async replace(
    tenant: TenantContext,
    leaveId: string,
    file: MultipartFile,
    audit: AuditContext
  ): Promise<LeaveRequest> {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new AppException('E_PAYLOAD_TOO_LARGE')
    if (!file.tmpPath) throw new AppException('E_BAD_REQUEST')
    const content = await readFile(file.tmpPath)
    const type = detectDocumentType(content)
    if (!type) {
      throw AppException.validation('file', 'documentType', 'validation.leave.attachmentType')
    }

    const { organizationId } = tenant
    const key = `${keyPrefix(organizationId, leaveId)}${newId()}.${type.extension}`
    try {
      await privateDisk().put(key, content, { contentType: type.mime, visibility: 'private' })
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }

    let previous: string | null = null
    let leave: LeaveRequest
    try {
      leave = await withTenant(organizationId, async (trx) => {
        const leaves = leaveRequestsIn(organizationId, trx)
        const locked = await leaves.findForUpdate(leaveId)
        if (!locked) throw new AppException('E_NOT_FOUND')
        previous = locked.attachmentPath
        locked.merge({ attachmentPath: key })
        await leaves.save(locked)
        await auditService.record(
          trx,
          { ...audit, organizationId, actorRole: tenant.primaryRole },
          {
            action: 'leave.attachment_uploaded',
            targetType: 'leave_request',
            targetId: leaveId,
            after: { mime: type.mime, bytes: content.length, replaced: previous !== null },
          }
        )
        return locked
      })
    } catch (error) {
      await this.deleteQuietly(key)
      throw error
    }

    if (previous && this.ownedBy(organizationId, leaveId, previous)) {
      await this.deleteQuietly(previous)
    }
    return leave
  }

  /** Short-lived link to the private file, journaled (05 §7). */
  async url(tenant: TenantContext, leave: LeaveRequest, audit: AuditContext) {
    const path = leave.attachmentPath
    if (!path) throw new AppException('E_NOT_FOUND')
    await withTenant(tenant.organizationId, (trx) =>
      auditService.record(
        trx,
        { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole },
        { action: 'sensitive_document.viewed', targetType: 'leave_request', targetId: leave.id }
      )
    )
    try {
      const url = await privateDisk().getSignedUrl(path, {
        expiresIn: `${ATTACHMENT_URL_TTL_SECONDS}s`,
      })
      return { url, expiresIn: ATTACHMENT_URL_TTL_SECONDS }
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
  }

  /** Only files under this leave's own prefix are ever deleted. */
  private ownedBy(organizationId: string, leaveId: string, key: string) {
    return key.startsWith(keyPrefix(organizationId, leaveId))
  }

  private async deleteQuietly(key: string) {
    try {
      await privateDisk().delete(key)
    } catch (error) {
      logger.warn({ err: error, key }, 'leave.attachment_delete_failed')
    }
  }
}

export default new LeaveAttachmentService()
