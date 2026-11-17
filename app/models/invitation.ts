import { DateTime } from 'luxon'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { InvitationSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type InvitationStatus = InvitationSchema['status']

/**
 * Invitation to join an organization (docs/backend/02 §3, 04 §3). Never
 * serialized directly: `tokenHash` must not leave the API.
 */
export default class Invitation extends InvitationSchema {
  static table = 'invitations'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(invitation: Invitation) {
    invitation.id ??= newId()
  }

  /** Pending and not yet past its expiry date. */
  get isUsable(): boolean {
    return this.status === 'pending' && this.expiresAt > DateTime.now()
  }

  /** Status as seen by clients: a pending invitation past its date is expired. */
  get effectiveStatus(): InvitationStatus {
    return this.status === 'pending' && !this.isUsable ? 'expired' : this.status
  }
}
