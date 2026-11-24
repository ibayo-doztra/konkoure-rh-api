import type Organization from '#models/organization'
import type Plan from '#models/plan'
import type PlatformAdmin from '#models/platform_admin'
import type User from '#models/user'
import type Subscription from '#models/subscription'
import type { Entitlements } from '#modules/billing/services/entitlement_service'
import { planDto, subscriptionDto } from '#modules/billing/transformers/billing_transformer'
import type { OrganizationRow } from '#modules/platform/repositories/platform_organization_repository'
import type { Membership } from '#modules/platform/repositories/platform_user_repository'

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

export function platformOrganizationRowDto(row: OrganizationRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: iso(row.createdAt),
    employees: row.employees,
    subscription: row.subscriptionStatus
      ? {
          status: row.subscriptionStatus,
          cycle: row.cycle,
          planCode: row.planCode,
          planName: row.planName,
          trialEndsAt: iso(row.trialEndsAt),
          currentPeriodEnd: iso(row.currentPeriodEnd),
        }
      : null,
  }
}

export function platformOrganizationDto(detail: {
  organization: Organization
  subscription: Subscription | null
  entitlements: Entitlements | null
  usage: unknown
  counts: { members: number; employees: number }
  owners: Array<{ id: string; email: string; fullName: string | null }>
}) {
  const { organization } = detail
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    countryCode: organization.countryCode,
    timezone: organization.timezone,
    defaultLanguage: organization.defaultLanguage,
    createdAt: organization.createdAt.toISO(),
    deletedAt: organization.deletedAt?.toISO() ?? null,
    subscription:
      detail.subscription && detail.entitlements
        ? {
            ...subscriptionDto(detail.subscription, detail.entitlements),
            storedStatus: detail.subscription.status,
            maxEmployeesOverride: detail.subscription.maxEmployeesOverride,
            modulesOverride: detail.subscription.modulesOverride,
          }
        : null,
    usage: detail.usage,
    counts: detail.counts,
    owners: detail.owners,
  }
}

/** Back-office plan: the public shape plus what only the platform manages. */
export function platformPlanDto(plan: Plan) {
  return {
    ...planDto(plan),
    priceGnf: Number(plan.priceGnf),
    explicitYearlyPriceGnf: plan.priceYearlyGnf === null ? null : Number(plan.priceYearlyGnf),
    sortOrder: plan.sortOrder,
    isPublic: plan.isPublic,
    deletedAt: plan.deletedAt?.toISO() ?? null,
  }
}

/** Back-office account: identity and access only, no personal file data (06 §13). */
export function platformUserDto(
  user: User,
  memberships: Membership[] = [],
  platformLevel: string | null = null
) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    emailVerified: user.emailVerifiedAt !== null,
    lastLoginAt: user.lastLoginAt?.toISO() ?? null,
    createdAt: user.createdAt.toISO(),
    platformLevel,
    organizations: memberships,
  }
}

export function platformAdminDto(admin: PlatformAdmin, user: User | null) {
  return {
    userId: admin.userId,
    email: user?.email ?? null,
    fullName: user?.fullName ?? null,
    level: admin.level,
    createdAt: admin.createdAt.toISO(),
  }
}
