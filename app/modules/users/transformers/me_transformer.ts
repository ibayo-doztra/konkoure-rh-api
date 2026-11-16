import type User from '#models/user'
import type { MembershipRow } from '#modules/users/repositories/membership_repository'
import type { SessionRow } from '#modules/auth/repositories/refresh_token_repository'

/**
 * Explicit output shapes: only the listed fields leave the API, so password
 * hashes, lockout counters and tokens can never be serialized by accident.
 */
export function userDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    preferredLanguage: user.preferredLanguage as 'fr' | 'en',
    mustChangePassword: Boolean(user.mustResetPassword),
  }
}

/** Short organization entry returned by /auth/login and /auth/register (06 §1). */
export function loginOrganizationDto(row: MembershipRow) {
  return { id: row.id, name: row.name, slug: row.slug, logoUrl: row.logoUrl, roles: row.roles }
}

export function organizationDto(row: MembershipRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    defaultLanguage: row.defaultLanguage,
    defaultCurrency: row.defaultCurrency,
    // Filled from `subscriptions` by the billing module.
    plan: null as string | null,
    performanceModel: row.performanceModel,
    roles: row.roles,
  }
}

/** `GET /me` payload (06-api-reference §2). */
export function meDto(snapshot: {
  user: User
  isPlatformAdmin: boolean
  organizations: MembershipRow[]
}) {
  return {
    user: userDto(snapshot.user),
    isPlatformAdmin: snapshot.isPlatformAdmin,
    organizations: snapshot.organizations.map(organizationDto),
    employee: null,
    subscription: null,
    modules: [] as string[],
  }
}

export function sessionDto(row: SessionRow, currentFamilyId: string | null) {
  return {
    id: row.familyId,
    deviceLabel: row.deviceLabel,
    ip: row.ip,
    userAgent: row.userAgent,
    startedAt: row.startedAt.toISO(),
    lastActivityAt: row.lastActivityAt.toISO(),
    expiresAt: row.expiresAt.toISO(),
    current: row.familyId === currentFamilyId,
  }
}
