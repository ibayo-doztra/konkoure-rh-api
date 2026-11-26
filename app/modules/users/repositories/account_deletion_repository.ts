import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { platformClient } from '#shared/platform/platform_client'

/**
 * Queries of the account deletion (docs/backend/04 §3, 05 §13). `users`,
 * `user_roles`, `platform_admins` and `password_reset_tokens` are global
 * tables; the tenant rows (`employees`, `notifications`) are changed
 * organization by organization, with `app.org_id` set for each one.
 */
export class AccountDeletionRepository {
  /**
   * Organizations holding data of the user: memberships (deleted organizations
   * included) and linked employee records, which may outlive the roles.
   * @platformScope — cross-organization read of `employees`.
   */
  async organizationsOf(userId: string): Promise<string[]> {
    const roles = await platformClient()
      .from('user_roles')
      .where('user_id', userId)
      .distinct('organization_id')
    const employees = await platformClient()
      .from('employees')
      .where('user_id', userId)
      .distinct('organization_id')
    return [...new Set([...roles, ...employees].map((row) => row.organization_id as string))].sort()
  }

  /**
   * Non-deleted organizations where the user is the only active owner. The
   * owner rows are locked first, so two owners deleting their accounts at the
   * same time cannot both leave the organization without one.
   */
  async soleOwnerships(userId: string, trx: TransactionClientContract): Promise<string[]> {
    const owned = trx
      .from('user_roles')
      .where('user_id', userId)
      .where('role', 'owner')
      .select('organization_id')
    await trx
      .from('user_roles')
      .where('role', 'owner')
      .whereIn('organization_id', owned)
      .forUpdate()
      .select('id')
    const rows = await trx
      .from('user_roles as ur')
      .join('organizations as o', 'o.id', 'ur.organization_id')
      .where('ur.user_id', userId)
      .where('ur.role', 'owner')
      .whereNull('o.deleted_at')
      .whereNotExists((query) =>
        query
          .from('user_roles as other')
          .join('users as u', 'u.id', 'other.user_id')
          .whereColumn('other.organization_id', 'ur.organization_id')
          .where('other.role', 'owner')
          .whereNot('other.user_id', userId)
          .whereNull('u.deleted_at')
          .where('u.is_active', true)
      )
      .orderBy('ur.organization_id')
      .select('ur.organization_id')
    return rows.map((row) => row.organization_id as string)
  }

  /** Detaches the user from one organization: employee records kept, unlinked; notifications removed. */
  async detachFrom(organizationId: string, userId: string, trx: TransactionClientContract) {
    await trx.rawQuery(`select set_config('app.org_id', ?, true)`, [organizationId])
    await trx
      .from('employees')
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .update({ user_id: null, updated_at: new Date() })
    await trx
      .from('notifications')
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .delete()
  }

  async removeRoles(userId: string, trx: TransactionClientContract) {
    await trx.from('user_roles').where('user_id', userId).delete()
  }

  async removeResetTokens(userId: string, trx: TransactionClientContract) {
    await trx.from('password_reset_tokens').where('user_id', userId).delete()
  }
}

export default new AccountDeletionRepository()
