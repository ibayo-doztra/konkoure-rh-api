import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Plan from '#models/plan'
import Subscription, { type SubscriptionStatus } from '#models/subscription'
import { accessError, computeEntitlements } from '#modules/billing/services/entitlement_service'

const now = DateTime.fromISO('2026-11-18T12:00:00Z')

function plan(code = 'pro') {
  const row = new Plan()
  row.code = code
  row.name = code
  row.priceGnf = '1490000.00' as never
  row.priceYearlyGnf = null
  row.maxEmployees = 250
  row.aiCreditsPerMonth = 500
  row.modules = ['hr', 'leaves', 'recruitment']
  return row
}

function subscription(status: SubscriptionStatus, periodEndDays: number) {
  const row = new Subscription()
  row.status = status
  row.cycle = 'monthly'
  row.currentPeriodEnd = now.plus({ days: periodEndDays })
  row.trialEndsAt = status === 'trialing' ? row.currentPeriodEnd : null
  row.modulesOverride = null
  row.maxEmployeesOverride = null
  return row
}

test.group('Entitlements (docs/backend/07 §6)', () => {
  test('{status} ending in {days} days is effectively {expected}')
    .with([
      { status: 'trialing', days: 5, expected: 'trialing' },
      { status: 'trialing', days: -1, expected: 'expired' },
      { status: 'active', days: 5, expected: 'active' },
      { status: 'active', days: -3, expected: 'past_due' },
      { status: 'active', days: -8, expected: 'expired' },
      { status: 'past_due', days: -6, expected: 'past_due' },
      { status: 'past_due', days: -7, expected: 'expired' },
      { status: 'canceled', days: 2, expected: 'canceled' },
      { status: 'canceled', days: -1, expected: 'expired' },
      { status: 'suspended', days: 30, expected: 'suspended' },
    ] as const)
    .run(({ assert }, { status, days, expected }) => {
      assert.equal(computeEntitlements(subscription(status, days), plan(), now).status, expected)
    })

  test('a cancelled subscription keeps its modules until the term', ({ assert }) => {
    const rights = computeEntitlements(subscription('canceled', 2), plan(), now)
    assert.deepEqual(rights.modules, ['hr', 'leaves', 'recruitment'])
    assert.isTrue(rights.planEffective)
  })

  test('overrides take precedence over the plan', ({ assert }) => {
    const row = subscription('active', 5)
    row.modulesOverride = ['talents']
    row.maxEmployeesOverride = 12
    const rights = computeEntitlements(row, plan(), now)
    assert.deepEqual(rights.modules, ['talents'])
    assert.equal(rights.maxEmployees, 12)
  })

  test('an expired subscription leaves HR readable only', ({ assert }) => {
    const rights = computeEntitlements(subscription('trialing', -1), plan('free'), now)
    assert.deepEqual(rights.modules, ['hr'])
    assert.isNull(accessError(rights, 'hr', true))
    assert.equal(accessError(rights, 'hr', false)?.errorCode, 'E_SUBSCRIPTION_INACTIVE')
    assert.equal(accessError(rights, 'leaves', true)?.errorCode, 'E_SUBSCRIPTION_INACTIVE')
  })

  test('a module outside the plan is refused with the upgrade details', ({ assert }) => {
    const rights = computeEntitlements(subscription('active', 5), plan(), now)
    const error = accessError(rights, 'talents', true)
    assert.equal(error?.errorCode, 'E_MODULE_NOT_INCLUDED')
    assert.deepEqual(
      error?.details.map(({ field, rule }) => [field, rule]),
      [
        ['requiredModule', 'talents'],
        ['currentPlan', 'pro'],
      ]
    )
  })

  test('an organization without subscription has no access', ({ assert }) => {
    assert.equal(accessError(null, 'hr', true)?.errorCode, 'E_SUBSCRIPTION_INACTIVE')
  })
})
