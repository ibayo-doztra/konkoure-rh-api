import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Invitation, { type InvitationStatus } from '#models/invitation'
import UserRole, { type AppRole } from '#models/user_role'

export interface InvitationListFilters {
  status?: InvitationStatus
  page: number
  perPage: number
}

/**
 * Tenant-scoped invitation access (docs/backend/05 §1–2): every method takes
 * the organization id, except the token lookup used by the public accept flow,
 * where the token itself designates the organization.
 */
export class InvitationRepository {
  private scoped(organizationId: string, trx?: TransactionClientContract) {
    return Invitation.query({ client: trx }).where('organization_id', organizationId)
  }

  findOrFail(organizationId: string, id: string, trx?: TransactionClientContract) {
    return this.scoped(organizationId, trx).where('id', id).firstOrFail()
  }

  findForUpdate(organizationId: string, id: string, trx: TransactionClientContract) {
    return this.scoped(organizationId, trx).where('id', id).forUpdate().first()
  }

  findPendingByEmail(organizationId: string, email: string, trx: TransactionClientContract) {
    return this.scoped(organizationId, trx)
      .where('email', email)
      .where('status', 'pending')
      .forUpdate()
      .first()
  }

  /** Cross-tenant by design: the secret token is the only key of the public flow. */
  findByTokenHash(tokenHash: string, trx?: TransactionClientContract) {
    const query = Invitation.query({ client: trx }).where('token_hash', tokenHash)
    return trx ? query.forUpdate().first() : query.first()
  }

  paginate(organizationId: string, filters: InvitationListFilters) {
    const query = this.scoped(organizationId).orderBy('created_at', 'desc').orderBy('id', 'desc')
    if (filters.status === 'expired') {
      query.where((q) =>
        q
          .where('status', 'expired')
          .orWhere((p) =>
            p.where('status', 'pending').where('expires_at', '<=', DateTime.now().toSQL())
          )
      )
    } else if (filters.status === 'pending') {
      query.where('status', 'pending').where('expires_at', '>', DateTime.now().toSQL())
    } else if (filters.status) {
      query.where('status', filters.status)
    }
    return query.paginate(filters.page, filters.perPage)
  }

  create(
    data: Pick<
      Invitation,
      'organizationId' | 'email' | 'role' | 'tokenHash' | 'expiresAt' | 'invitedBy'
    >,
    trx: TransactionClientContract
  ) {
    return Invitation.create(data, { client: trx })
  }

  save(invitation: Invitation, trx: TransactionClientContract) {
    invitation.useTransaction(trx)
    return invitation.save()
  }

  async isMember(organizationId: string, email: string, trx: TransactionClientContract) {
    const row = await trx
      .from('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.organization_id', organizationId)
      .where('u.email', email)
      .whereNull('u.deleted_at')
      .first()
    return Boolean(row)
  }

  /** Grants the role unless the user already holds it. */
  async grantRole(
    data: { userId: string; organizationId: string; role: AppRole; grantedBy: string | null },
    trx: TransactionClientContract
  ): Promise<boolean> {
    const existing = await UserRole.query({ client: trx })
      .where('user_id', data.userId)
      .where('organization_id', data.organizationId)
      .where('role', data.role)
      .first()
    if (existing) return false
    await UserRole.create(data, { client: trx })
    return true
  }
}

export default new InvitationRepository()
