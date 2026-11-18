import type Organization from '#models/organization'
import type { MemberRow } from '#modules/organizations/repositories/member_repository'
import { organizationSettingsDefaults, type OrganizationSettings } from '#config/tenant'

/** Stored settings completed section by section with the defaults (02 §11). */
export function resolveOrganizationSettings(stored: Record<string, unknown>): OrganizationSettings {
  const sections = Object.entries(organizationSettingsDefaults).map(([section, defaults]) => [
    section,
    { ...defaults, ...(stored[section] as object | undefined) },
  ])
  return Object.fromEntries(sections) as OrganizationSettings
}

/** `GET /org` (06-api-reference §3). */
export function organizationDetailDto(organization: Organization) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logoUrl: organization.logoUrl,
    countryCode: organization.countryCode,
    timezone: organization.timezone,
    defaultLanguage: organization.defaultLanguage,
    defaultCurrency: organization.defaultCurrency,
    performanceModel: organization.performanceModel,
    settings: resolveOrganizationSettings(organization.settings),
    createdAt: organization.createdAt.toISO(),
    updatedAt: organization.updatedAt.toISO(),
  }
}

export function memberDto(member: MemberRow) {
  return {
    userId: member.userId,
    email: member.email,
    fullName: member.fullName,
    avatarUrl: member.avatarUrl,
    roles: member.roles,
    joinedAt: member.joinedAt.toISO(),
  }
}
