import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AuditLog from '#models/audit_log'
import entitlementService from '#modules/billing/services/entitlement_service'
import subscriptionGrantService from '#modules/billing/services/subscription_grant_service'
import { createHrOrganization } from '#tests/helpers/hr'

test.group('subscription:grant (decision of 2026-11-23)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('gives an active plan at once and journals it', async ({ assert }) => {
    const org = await createHrOrganization()
    const before = await entitlementService.resolve(org.id)
    assert.notInclude(before!.modules, 'recruitment')

    const subscription = await subscriptionGrantService.grant(org.id, 'pro', 30)

    assert.equal(subscription.status, 'active')
    const after = await entitlementService.resolve(org.id)
    assert.equal(after!.planCode, 'pro')
    assert.include(after!.modules, 'recruitment')
    const [entry] = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'subscription.granted')
    assert.deepEqual(entry.afterData, { planCode: 'pro', days: 30 })
  })

  test('refuses an unknown plan, organization or duration', async ({ assert }) => {
    const org = await createHrOrganization()
    await assert.rejects(() => subscriptionGrantService.grant(org.id, 'gold', 30), /Unknown plan/)
    await assert.rejects(() => subscriptionGrantService.grant(org.id, 'pro', 0), /--days/)
    await assert.rejects(
      () => subscriptionGrantService.grant('01934c8e-0000-7000-8000-000000000000', 'pro', 30),
      'E_NOT_FOUND'
    )
  })
})
