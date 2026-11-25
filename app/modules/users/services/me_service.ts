import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import type Employee from '#models/employee'
import { AppException } from '#shared/exceptions/app_exception'
import { employeeOfUser } from '#modules/hr/repositories/employee_repository'
import users from '#modules/users/repositories/user_repository'
import memberships, { type MembershipRow } from '#modules/users/repositories/membership_repository'
import platformAdmins from '#modules/users/repositories/platform_admin_repository'
import refreshTokens, { type SessionRow } from '#modules/auth/repositories/refresh_token_repository'
import entitlementService, {
  type Entitlements,
} from '#modules/billing/services/entitlement_service'

export interface ProfileUpdate {
  fullName?: string
  avatarUrl?: string | null
  preferredLanguage?: 'fr' | 'en'
}

/**
 * Current-user data (docs/backend/06 §2). The server never picks the active
 * organization: rights are returned for the one the client names, if the user
 * belongs to it, like the linked employee record.
 */
export class MeService {
  async snapshot(
    user: User,
    selectedOrganizationId?: string | null
  ): Promise<{
    user: User
    isPlatformAdmin: boolean
    platformLevel: 'root' | 'support' | null
    organizations: MembershipRow[]
    entitlements: Entitlements | null
    employee: Employee | null
  }> {
    const [rows, platformLevel] = await Promise.all([
      memberships.forUser(user.id),
      platformAdmins.levelOf(user.id),
    ])
    const resolved = await Promise.all(rows.map((row) => entitlementService.resolve(row.id)))
    const organizations = rows.map((row, index) => ({
      ...row,
      plan: resolved[index]?.planCode ?? null,
    }))
    const selected = rows.findIndex((row) => row.id === selectedOrganizationId)
    return {
      user,
      isPlatformAdmin: platformLevel !== null,
      platformLevel,
      organizations,
      entitlements: selected >= 0 ? resolved[selected] : null,
      employee: selected >= 0 ? await employeeOfUser(rows[selected].id, user.id) : null,
    }
  }

  async organizations(user: User) {
    const { organizations } = await this.snapshot(user)
    return organizations
  }

  async updateProfile(user: User, changes: ProfileUpdate) {
    return db.transaction(async (trx) => {
      const fresh = await users.findByIdForUpdate(user.id, trx)
      if (!fresh) throw new AppException('E_UNAUTHORIZED')
      if (changes.fullName !== undefined) fresh.fullName = changes.fullName
      if (changes.avatarUrl !== undefined) fresh.avatarUrl = changes.avatarUrl
      if (changes.preferredLanguage !== undefined)
        fresh.preferredLanguage = changes.preferredLanguage
      await users.save(fresh, trx)
      return fresh
    })
  }

  sessions(user: User): Promise<SessionRow[]> {
    return refreshTokens.listSessions(user.id)
  }

  /** 404 for a session that is not one of the user's own. */
  async revokeSession(user: User, familyId: string) {
    if (!(await refreshTokens.familyBelongsTo(user.id, familyId))) {
      throw new AppException('E_NOT_FOUND')
    }
    await db.transaction((trx) => refreshTokens.revokeFamily(user.id, familyId, trx))
  }
}

export default new MeService()
