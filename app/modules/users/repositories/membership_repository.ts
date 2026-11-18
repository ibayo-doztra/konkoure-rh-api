import db from '@adonisjs/lucid/services/db'
import type { AppRole } from '#models/user_role'

export interface MembershipRow {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  defaultLanguage: string
  defaultCurrency: string
  performanceModel: 'classic' | 'sap'
  roles: AppRole[]
  /** Current plan code, filled from the subscription by the caller. */
  plan?: string | null
}

/**
 * Organizations a user belongs to (membership = at least one role, 02 §3),
 * with the roles held in each. Scoped by user id: a user only sees their own.
 */
export class MembershipRepository {
  async forUser(userId: string): Promise<MembershipRow[]> {
    const rows = await db
      .from('user_roles as ur')
      .join('organizations as o', 'o.id', 'ur.organization_id')
      .where('ur.user_id', userId)
      .whereNull('o.deleted_at')
      .groupBy('o.id')
      .orderBy('o.name', 'asc')
      .select(
        'o.id',
        'o.name',
        'o.slug',
        'o.logo_url',
        'o.default_language',
        'o.default_currency',
        'o.performance_model',
        db.raw('array_agg(ur.role::text ORDER BY ur.role) as roles')
      )

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
      defaultLanguage: row.default_language,
      defaultCurrency: row.default_currency,
      performanceModel: row.performance_model,
      roles: row.roles as AppRole[],
    }))
  }

  /**
   * Roles held by the user in one non-deleted organization (tenant middleware,
   * docs/backend/01 §4). Empty when the user is not a member.
   */
  async rolesIn(userId: string, organizationId: string): Promise<AppRole[]> {
    const rows = await db
      .from('user_roles as ur')
      .join('organizations as o', 'o.id', 'ur.organization_id')
      .where('ur.user_id', userId)
      .where('ur.organization_id', organizationId)
      .whereNull('o.deleted_at')
      .orderBy('ur.role')
      .select('ur.role')
    return rows.map((row) => row.role as AppRole)
  }
}

export default new MembershipRepository()
