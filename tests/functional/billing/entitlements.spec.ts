import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import AuditLog from '#models/audit_log'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import type Organization from '#models/organization'
import entitlementService from '#modules/billing/services/entitlement_service'
import EntitlementMiddleware from '#middleware/entitlement_middleware'
import { TenantContext } from '#shared/tenant/tenant_context'
import { apiLogin, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'

async function subscribe(organization: Organization, code: string, ends = { days: 20 }) {
  const plan = await Plan.findByOrFail('code', code)
  const end = DateTime.now().plus(ends)
  await Subscription.create({
    organizationId: organization.id,
    planId: plan.id,
    status: code === 'free' ? 'trialing' : 'active',
    cycle: 'monthly',
    trialEndsAt: code === 'free' ? end : null,
    currentPeriodStart: DateTime.now().minus({ days: 1 }),
    currentPeriodEnd: end,
  })
  await entitlementService.invalidate(organization.id)
}

async function memberOf(client: Parameters<typeof apiLogin>[0], organization: Organization) {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  await grantRoles(user, organization, ['employee'])
  const { accessToken } = await apiLogin(client, user.email)
  return accessToken
}

test.group('Subscriptions and entitlements', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the plan catalogue is seeded with the documented modules', async ({ assert }) => {
    const plans = await Plan.query().orderBy('sort_order')
    assert.deepEqual(
      plans.map((plan) => plan.code),
      ['free', 'starter', 'pro', 'enterprise']
    )
    assert.notInclude(plans[0].modules, 'recruitment')
    assert.notInclude(plans[0].modules, 'talents')
  })

  test('creating an organization opens an audited 30-day trial', async ({ client, assert }) => {
    const user = await createUser({ emailVerifiedAt: DateTime.now() })
    const { accessToken } = await apiLogin(client, user.email)

    const response = await expectStatus(
      client.post('/api/v1/organizations').bearerToken(accessToken).json({ name: 'Doztra' }),
      201
    )
    const { id, plan } = response.body().data
    assert.equal(plan, 'free')

    const subscription = await Subscription.findByOrFail('organization_id', id)
    assert.equal(subscription.status, 'trialing')
    assert.closeTo(subscription.trialEndsAt!.diffNow('days').days, 30, 0.01)
    const audit = await AuditLog.query()
      .where('organization_id', id)
      .where('target_id', subscription.id)
    assert.deepEqual(
      audit.map((row) => row.action),
      ['subscription.changed']
    )
  })

  test('GET /me returns the rights of the organization named by the header', async ({
    client,
    assert,
  }) => {
    const organization = await createOrganization('Alpha')
    await subscribe(organization, 'pro')
    const token = await memberOf(client, organization)

    const without = await expectStatus(client.get('/api/v1/me').bearerToken(token), 200)
    assert.isNull(without.body().data.subscription)
    assert.deepEqual(without.body().data.modules, [])
    assert.equal(without.body().data.organizations[0].plan, 'pro')

    const selected = await expectStatus(
      client.get('/api/v1/me').bearerToken(token).header('X-Organization-Id', organization.id),
      200
    )
    const { subscription, modules } = selected.body().data
    assert.include(modules, 'recruitment')
    assert.containsSubset(subscription, {
      planCode: 'pro',
      status: 'active',
      cycle: 'monthly',
      priceGnf: 1_490_000,
      planEffective: true,
    })
  })

  test('GET /me reveals nothing about an organization of someone else', async ({
    client,
    assert,
  }) => {
    const mine = await createOrganization('Alpha')
    const other = await createOrganization('Beta')
    await subscribe(mine, 'free')
    await subscribe(other, 'enterprise')
    const token = await memberOf(client, mine)

    const response = await expectStatus(
      client.get('/api/v1/me').bearerToken(token).header('X-Organization-Id', other.id),
      200
    )
    assert.isNull(response.body().data.subscription)
    assert.deepEqual(response.body().data.modules, [])
  })

  test('an invalid organization header on GET /me is ignored', async ({ client, assert }) => {
    const organization = await createOrganization('Alpha')
    const token = await memberOf(client, organization)
    const response = await expectStatus(
      client.get('/api/v1/me').bearerToken(token).header('X-Organization-Id', 'nope'),
      200
    )
    assert.isNull(response.body().data.subscription)
  })

  test('GET /org/entitlements is scoped to the tenant', async ({ client, assert }) => {
    const organization = await createOrganization('Alpha')
    const other = await createOrganization('Beta')
    await subscribe(organization, 'free')
    const token = await memberOf(client, organization)

    const response = await expectStatus(
      client
        .get('/api/v1/org/entitlements')
        .bearerToken(token)
        .header('X-Organization-Id', organization.id),
      200
    )
    assert.containsSubset(response.body().data, { planCode: 'free', status: 'trialing' })
    assert.notInclude(response.body().data.modules, 'recruitment')

    const denied = await expectStatus(
      client
        .get('/api/v1/org/entitlements')
        .bearerToken(token)
        .header('X-Organization-Id', other.id),
      403
    )
    assert.equal(errorOf(denied).code, 'E_FORBIDDEN')
  })

  test('the entitlement middleware enforces the plan', async ({ assert }) => {
    const trial = await createOrganization('Alpha')
    const paid = await createOrganization('Beta')
    await subscribe(trial, 'free')
    await subscribe(paid, 'pro')

    const run = async (organization: Organization) => {
      const ctx = await testUtils.createHttpContext()
      ctx.tenant = new TenantContext(organization.id, ['employee'])
      let reached = false
      await new EntitlementMiddleware().handle(
        ctx,
        async () => {
          reached = true
        },
        { module: 'recruitment' }
      )
      return reached
    }

    await assert.rejects(() => run(trial), 'E_MODULE_NOT_INCLUDED')
    assert.isTrue(await run(paid))
  })

  test('subscriptions stay inside their tenant for the application role', async ({ assert }) => {
    const alpha = await createOrganization('Alpha')
    const beta = await createOrganization('Beta')
    await subscribe(alpha, 'free')
    await subscribe(beta, 'pro')

    const trx = await db.transaction()
    try {
      await trx.rawQuery('SET LOCAL ROLE konkoure_app')
      await trx.rawQuery(`select set_config('app.org_id', ?, true)`, [alpha.id])
      const rows = await trx.from('subscriptions')
      assert.deepEqual(
        rows.map((row) => row.organization_id),
        [alpha.id]
      )
    } finally {
      await trx.rollback()
    }
  })
})
