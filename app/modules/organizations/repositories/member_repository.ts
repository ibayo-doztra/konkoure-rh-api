import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import UserRole, { type AppRole } from '#models/user_role'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface MemberRow {
  userId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  roles: AppRole[]
  joinedAt: DateTime
}

interface RawMember {
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  roles: AppRole[]
  joined_at: Date
}

function toMember(row: RawMember): MemberRow {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    roles: row.roles,
    joinedAt: DateTime.fromJSDate(row.joined_at),
  }
}

/** What an e-mail needs of a recipient. */
export interface MailAccount {
  id: string
  email: string
  fullName: string | null
  preferredLanguage: string
}

interface RawAccount {
  id: string
  email: string
  full_name: string | null
  preferred_language: string
}

const toAccount = (row: RawAccount): MailAccount => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  preferredLanguage: row.preferred_language,
})

/** Members of an organization: users holding at least one role (02 §3). */
export class MemberRepository extends TenantRepository<typeof UserRole> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(UserRole, organizationId, trx)
  }

  private members() {
    return this.trx
      .from('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.organization_id', this.organizationId)
      .whereNull('u.deleted_at')
      .groupBy('u.id')
      .select(
        'u.id as user_id',
        'u.email',
        'u.full_name',
        'u.avatar_url',
        db.raw('array_agg(ur.role::text ORDER BY ur.role) as roles'),
        db.raw('min(ur.created_at) as joined_at')
      )
  }

  async paginate(filters: { page: number; perPage: number }) {
    const page = await this.members()
      .orderBy('joined_at', 'asc')
      .orderBy('u.id', 'asc')
      .paginate(filters.page, filters.perPage)
    return { rows: (page.all() as RawMember[]).map(toMember), meta: page.getMeta() }
  }

  /** Active accounts holding `role`, to notify them (e-mail recipients). */
  async accountsWithRole(role: AppRole): Promise<MailAccount[]> {
    const rows: RawAccount[] = await this.trx
      .from('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.organization_id', this.organizationId)
      .where('ur.role', role)
      .whereNull('u.deleted_at')
      .where('u.is_active', true)
      .orderBy('u.id', 'asc')
      .select('u.id', 'u.email', 'u.full_name', 'u.preferred_language')
    return rows.map(toAccount)
  }

  /** Active account linked to an employee record, if any. */
  async accountOfEmployee(employeeId: string): Promise<MailAccount | null> {
    const row: RawAccount | null = await this.trx
      .from('employees as e')
      .join('users as u', 'u.id', 'e.user_id')
      .where('e.organization_id', this.organizationId)
      .where('e.id', employeeId)
      .whereNull('e.deleted_at')
      .whereNull('u.deleted_at')
      .where('u.is_active', true)
      .select('u.id', 'u.email', 'u.full_name', 'u.preferred_language')
      .first()
    return row ? toAccount(row) : null
  }

  async findMember(userId: string): Promise<MemberRow | null> {
    const row = await this.members().where('u.id', userId).first()
    return row ? toMember(row as RawMember) : null
  }

  async grant(userId: string, role: AppRole, grantedBy: string) {
    await UserRole.create(
      { userId, role, grantedBy, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  async revoke(userId: string, roles: AppRole[]) {
    await this.query().where('user_id', userId).whereIn('role', roles).delete()
  }

  /** "Active" owner: a usable account (04 §5). */
  async hasOtherActiveOwner(userId: string) {
    const row = await this.trx
      .from('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.organization_id', this.organizationId)
      .where('ur.role', 'owner')
      .whereNot('ur.user_id', userId)
      .whereNull('u.deleted_at')
      .where('u.is_active', true)
      .first()
    return Boolean(row)
  }
}

export function membersIn(organizationId: string, trx: TransactionClientContract) {
  return new MemberRepository(organizationId, trx)
}
