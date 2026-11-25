import type User from '#models/user'
import type Employee from '#models/employee'
import type { MembershipRow } from '#modules/users/repositories/membership_repository'
import type { SessionRow } from '#modules/auth/repositories/refresh_token_repository'
import type { Entitlements } from '#modules/billing/services/entitlement_service'
import { subscriptionDto } from '#modules/billing/transformers/entitlement_transformer'

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
    plan: row.plan ?? null,
    performanceModel: row.performanceModel,
    roles: row.roles,
  }
}

/** `GET /me` payload (06-api-reference §2). */
export function meDto(snapshot: {
  user: User
  isPlatformAdmin: boolean
  platformLevel: 'root' | 'support' | null
  impersonation?: { by: string; expiresAt: string | null } | null
  organizations: MembershipRow[]
  entitlements: Entitlements | null
  employee: Employee | null
}) {
  const { employee } = snapshot
  return {
    user: userDto(snapshot.user),
    isPlatformAdmin: snapshot.isPlatformAdmin,
    // Active admin level (decision of 2026-11-25): the client hides root-only actions.
    platformLevel: snapshot.platformLevel,
    // Set when a platform admin acts as this account: the client shows a banner.
    impersonation: snapshot.impersonation ?? null,
    organizations: snapshot.organizations.map(organizationDto),
    employee: employee
      ? { id: employee.id, firstName: employee.firstName, lastName: employee.lastName }
      : null,
    subscription: snapshot.entitlements ? subscriptionDto(snapshot.entitlements) : null,
    modules: snapshot.entitlements?.modules ?? [],
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
