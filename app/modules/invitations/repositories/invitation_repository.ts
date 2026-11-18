import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Invitation, { type InvitationStatus } from '#models/invitation'
import UserRole, { type AppRole } from '#models/user_role'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface InvitationListFilters {
  status?: InvitationStatus
  page: number
  perPage: number
}

/** Tenant-scoped invitation access (docs/backend/05 §1–2). */
export class InvitationRepository extends TenantRepository<typeof Invitation> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Invitation, organizationId, trx)
  }

  findPendingByEmail(email: string) {
    return this.query().where('email', email).where('status', 'pending').forUpdate().first()
  }

  findByTokenHash(tokenHash: string, options: { lock?: boolean } = {}) {
    const query = this.query().where('token_hash', tokenHash)
    return options.lock ? query.forUpdate().first() : query.first()
  }

  paginate(filters: InvitationListFilters) {
    const query = this.query().orderBy('created_at', 'desc').orderBy('id', 'desc')
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

  create(data: Pick<Invitation, 'email' | 'role' | 'tokenHash' | 'expiresAt' | 'invitedBy'>) {
    return Invitation.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  async isMember(email: string) {
    const row = await this.trx
      .from('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.organization_id', this.organizationId)
      .where('u.email', email)
      .whereNull('u.deleted_at')
      .first()
    return Boolean(row)
  }

  /** Grants the role unless the user already holds it. */
  async grantRole(data: {
    userId: string
    role: AppRole
    grantedBy: string | null
  }): Promise<boolean> {
    const existing = await UserRole.query({ client: this.trx })
      .where('user_id', data.userId)
      .where('organization_id', this.organizationId)
      .where('role', data.role)
      .first()
    if (existing) return false
    await UserRole.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
    return true
  }
}

export function invitationsIn(organizationId: string, trx: TransactionClientContract) {
  return new InvitationRepository(organizationId, trx)
}

/**
 * Organization designated by a secret invitation token, the only cross-tenant
 * lookup of the public flow (definer function, migration 0114).
 */
export async function organizationIdForInvitationToken(tokenHash: string): Promise<string | null> {
  const result = await db.rawQuery('select invitation_org_id_for_token(?) as id', [tokenHash])
  return result.rows[0]?.id ?? null
}
