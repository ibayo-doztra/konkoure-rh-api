import type { Entitlements } from '#modules/billing/services/entitlement_service'

/** `subscription` of `GET /me` (docs/backend/06 §2). */
export function subscriptionDto(entitlements: Entitlements) {
  return {
    planCode: entitlements.planCode,
    planName: entitlements.planName,
    maxEmployees: entitlements.maxEmployees,
    aiCreditsPerMonth: entitlements.aiCreditsPerMonth,
    status: entitlements.status,
    currentPeriodEnd: entitlements.currentPeriodEnd,
    cycle: entitlements.cycle,
    priceGnf: entitlements.priceGnf,
    trialEndsAt: entitlements.trialEndsAt,
    planEffective: entitlements.planEffective,
  }
}

/** `GET /org/entitlements` (docs/backend/06 §3). */
export function entitlementsDto(entitlements: Entitlements) {
  return {
    planCode: entitlements.planCode,
    status: entitlements.status,
    modules: entitlements.modules,
    readOnlyModules: entitlements.readOnlyModules,
    maxEmployees: entitlements.maxEmployees,
    aiCreditsPerMonth: entitlements.aiCreditsPerMonth,
    trialEndsAt: entitlements.trialEndsAt,
    currentPeriodEnd: entitlements.currentPeriodEnd,
  }
}
