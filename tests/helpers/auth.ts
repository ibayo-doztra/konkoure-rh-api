import hash from '@adonisjs/core/services/hash'
import type { ApiClient } from '@japa/api-client'
import User from '#models/user'
import Organization from '#models/organization'
import UserRole, { type AppRole } from '#models/user_role'
import PlatformAdmin from '#models/platform_admin'

export const STRONG_PASSWORD = 'Konakry-Rh-2026'
let sequence = 0

export async function createUser(overrides: Partial<User> & { password?: string } = {}) {
  sequence += 1
  const { password = STRONG_PASSWORD, ...rest } = overrides
  return User.create({
    email: `user${sequence}-${Date.now()}@konkoure.test`,
    fullName: 'Mariama Camara',
    preferredLanguage: 'fr',
    passwordHash: await hash.make(password),
    ...rest,
  })
}

export async function createOrganization(name = 'Doztra') {
  sequence += 1
  return Organization.create({ name, slug: `${name.toLowerCase()}-${sequence}-${Date.now()}` })
}

export async function grantRoles(user: User, organization: Organization, roles: AppRole[]) {
  for (const role of roles) {
    await UserRole.create({ userId: user.id, organizationId: organization.id, role })
  }
}

export async function makePlatformAdmin(user: User) {
  return PlatformAdmin.create({ userId: user.id, level: 'support', isActive: true })
}

/** Logs in through the API, returning the real token pair of a new session. */
export async function apiLogin(client: ApiClient, email: string, password = STRONG_PASSWORD) {
  const response = await client.post('/api/v1/auth/login').json({ email, password })
  response.assertStatus(200)
  const data = response.body().data as {
    accessToken: string
    refreshToken: string
  }
  return data
}
