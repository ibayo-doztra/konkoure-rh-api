import type Invitation from '#models/invitation'
import type { InvitationPreview } from '#modules/invitations/services/invitation_service'

/** Explicit invitation shape: the token hash never leaves the API. */
export function invitationDto(invitation: Invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    employeeId: invitation.employeeId,
    status: invitation.effectiveStatus,
    expiresAt: invitation.expiresAt.toISO(),
    invitedBy: invitation.invitedBy,
    sendCount: invitation.sendCount,
    lastSentAt: invitation.lastSentAt.toISO(),
    acceptedAt: invitation.acceptedAt?.toISO() ?? null,
    createdAt: invitation.createdAt.toISO(),
  }
}

export function invitationPreviewDto(preview: InvitationPreview) {
  return { ...preview, expiresAt: preview.expiresAt.toISO() }
}
