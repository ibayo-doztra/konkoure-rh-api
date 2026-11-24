import type Organization from '#models/organization'
import type Plan from '#models/plan'
import type Subscription from '#models/subscription'
import type { Entitlements } from '#modules/billing/services/entitlement_service'
import { planDto, subscriptionDto } from '#modules/billing/transformers/billing_transformer'
import type { OrganizationRow } from '#modules/platform/repositories/platform_organization_repository'

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
