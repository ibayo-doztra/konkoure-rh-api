import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type LeaveRequest from '#models/leave_request'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import fileStorage from '#shared/files/file_storage'
import { filesIn } from '#shared/files/file_repository'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { detectDocumentType } from '#shared/utils/document_signature'
import { leaveRequestsIn } from '#modules/leaves/repositories/leave_request_repository'

/** Documents are limited to 10 MB (docs/backend/05 §3). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** `files.owner_type` of leave supporting documents (`owner_id` = the leave). */
export const ATTACHMENT_OWNER = 'leave_attachment'

const keyPrefix = (organizationId: string, leaveId: string) =>
  `${organizationId}/leave_request/${leaveId}/`

/**
 * Supporting document of a leave, in the private bucket (08 §6), recorded in the
 * `files` registry. Storage calls stay outside the transaction.
 */
export class LeaveAttachmentService {
  async replace(
    tenant: TenantContext,
    leaveId: string,
    file: MultipartFile,
    audit: AuditContext
  ): Promise<LeaveRequest> {
    const { organizationId } = tenant
    const upload = await fileStorage.check(file, MAX_ATTACHMENT_BYTES, detectDocumentType, () =>
      AppException.validation('file', 'documentType', 'validation.leave.attachmentType')
    )
    const key = fileStorage.key(organizationId, 'leave_request', leaveId, upload.type.extension)
    const stored = await fileStorage.put('private', key, upload)

    let previous: string | null = null
    let leave: LeaveRequest
    try {
      leave = await withTenant(organizationId, async (trx) => {
        const leaves = leaveRequestsIn(organizationId, trx)
        const locked = await leaves.findForUpdate(leaveId)
        if (!locked) throw new AppException('E_NOT_FOUND')
        previous = locked.attachmentPath
        const files = filesIn(organizationId, trx)
        if (previous) await files.forgetPaths([previous])
        await files.create({
          ...stored,
          ownerType: ATTACHMENT_OWNER,
          ownerId: leaveId,
          uploadedBy: audit.actorUserId ?? null,
        })
        locked.merge({ attachmentPath: key })
        await leaves.save(locked)
        await auditService.record(
          trx,
          { ...audit, organizationId, actorRole: tenant.primaryRole },
          {
            action: 'leave.attachment_uploaded',
            targetType: 'leave_request',
            targetId: leaveId,
            after: { mime: stored.mime, bytes: stored.sizeBytes, replaced: previous !== null },
          }
        )
        return locked
      })
    } catch (error) {
      await fileStorage.deleteQuietly('private', key)
      throw error
    }

    if (previous && this.ownedBy(organizationId, leaveId, previous)) {
      await fileStorage.deleteQuietly('private', previous)
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
    return fileStorage.signedUrl(path)
  }

  /** Only files under this leave's own prefix are ever deleted. */
  private ownedBy(organizationId: string, leaveId: string, key: string) {
    return key.startsWith(keyPrefix(organizationId, leaveId))
  }
}

export default new LeaveAttachmentService()
