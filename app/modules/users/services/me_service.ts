import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import users from '#modules/users/repositories/user_repository'
import memberships, { type MembershipRow } from '#modules/users/repositories/membership_repository'
import platformAdmins from '#modules/users/repositories/platform_admin_repository'
import refreshTokens, { type SessionRow } from '#modules/auth/repositories/refresh_token_repository'

export interface ProfileUpdate {
  fullName?: string
  avatarUrl?: string | null
  preferredLanguage?: 'fr' | 'en'
}

/**
 * Current-user data (docs/backend/06 §2). `employee`, `subscription` and
 * `modules` are filled once the HR and billing modules exist.
 */
export class MeService {
  async snapshot(user: User): Promise<{
    user: User
    isPlatformAdmin: boolean
    organizations: MembershipRow[]
  }> {
    const [organizations, isPlatformAdmin] = await Promise.all([
      memberships.forUser(user.id),
      platformAdmins.isActive(user.id),
    ])
    return { user, isPlatformAdmin, organizations }
  }

  organizations(user: User) {
    return memberships.forUser(user.id)
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
