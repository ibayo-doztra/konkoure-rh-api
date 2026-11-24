import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import type Organization from '#models/organization'
import Plan from '#models/plan'
import PlatformAdmin from '#models/platform_admin'
import Subscription from '#models/subscription'
import entitlementService from '#modules/billing/services/entitlement_service'
import { apiLogin, createUser } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession } from '#tests/helpers/hr'
import { createRecruitingOrganization } from '#tests/helpers/recruitment'

/** Logged-in platform admin (`root` or `support`), or a plain user without `level`. */
async function platformSession(
  client: ApiClient,
  level?: 'root' | 'support',
  options: { active?: boolean } = {}
) {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  if (level) {
    await PlatformAdmin.create({ userId: user.id, level, isActive: options.active ?? true })
  }
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

const call = (client: ApiClient, method: string, path: string, who: { accessToken: string }) =>
  client.request(`/api/v1/platform${path}`, method).bearerToken(who.accessToken)

const currentOf = (organization: Organization) =>
  Subscription.query()
    .where('organization_id', organization.id)
    .orderBy('created_at', 'desc')
    .firstOrFail()

test.group('Platform gate', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('only active platform admins enter; support cannot write', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const nobody = await platformSession(client)
    const inactive = await platformSession(client, 'root', { active: false })
    const support = await platformSession(client, 'support')

    await expectStatus(call(client, 'GET', '/dashboard', owner), 403)
    await expectStatus(call(client, 'GET', '/dashboard', nobody), 403)
    await expectStatus(call(client, 'GET', '/dashboard', inactive), 403)
    await expectStatus(client.get('/api/v1/platform/dashboard'), 401)
    await expectStatus(call(client, 'GET', '/dashboard', support), 200)

    const refused = await expectStatus(
      call(client, 'POST', `/organizations/${org.id}/suspend`, support),
      403
    )
    assert.equal(errorOf(refused).code, 'E_FORBIDDEN')
  })
})

test.group('Platform organizations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the dashboard computes MRR, statuses and churn', async ({ client, assert }) => {
    const support = await platformSession(client, 'support')
    const beforeResponse = await expectStatus(call(client, 'GET', '/dashboard', support), 200)
    const before = beforeResponse.body().data
    await createHrOrganization('Essai')
    await createRecruitingOrganization('Pro mensuel')
    const yearly = await createRecruitingOrganization('Pro annuel')
    const lost = await createRecruitingOrganization('Perdue')
    const yearlySubscription = await currentOf(yearly)
    yearlySubscription.cycle = 'yearly'
    await yearlySubscription.save()
    const lostSubscription = await currentOf(lost)
    lostSubscription.merge({
      status: 'canceled',
      currentPeriodEnd: DateTime.now().minus({ days: 3 }),
    })
    await lostSubscription.save()

    const afterResponse = await expectStatus(call(client, 'GET', '/dashboard', support), 200)
    const after = afterResponse.body().data
    assert.equal(after.organizations.live - before.organizations.live, 4)
    assert.equal(after.subscriptions.trialing - before.subscriptions.trialing, 1)
    assert.equal(after.subscriptions.active - before.subscriptions.active, 2)
    // Monthly 1 490 000 + yearly 14 900 000 / 12.
    assert.closeTo(after.mrrGnf - before.mrrGnf, 1_490_000 + 14_900_000 / 12, 1)
    assert.equal(after.churn30d - before.churn30d, 1)
  })

  test('lists, filters and details organizations across tenants', async ({ client, assert }) => {
    const support = await platformSession(client, 'support')
    const trial = await createHrOrganization('Kaloum Services')
    const pro = await createRecruitingOrganization('Matoto Logistique')
    const owner = await hrSession(client, pro, ['owner'])
    await createEmployee(pro)

    const searched = await expectStatus(
      call(client, 'GET', '/organizations?q=matoto', support),
      200
    )
    assert.deepEqual(
      searched.body().data.map((row: { id: string }) => row.id),
      [pro.id]
    )
    assert.deepInclude(searched.body().data[0].subscription, { status: 'active', planCode: 'pro' })
    assert.equal(searched.body().data[0].employees, 2)

    const trials = await expectStatus(
      call(client, 'GET', '/organizations?filter[status]=trialing&filter[plan]=free', support),
      200
    )
    const ids = trials.body().data.map((row: { id: string }) => row.id)
    assert.include(ids, trial.id)
    assert.notInclude(ids, pro.id)

    const detail = await expectStatus(call(client, 'GET', `/organizations/${pro.id}`, support), 200)
    const data = detail.body().data
    assert.deepInclude(data, { id: pro.id, name: 'Matoto Logistique' })
    assert.deepEqual(data.counts, { members: 1, employees: 2 })
    assert.deepEqual(data.owners, [
      { id: owner.user.id, email: owner.user.email, fullName: owner.user.fullName },
    ])
    assert.deepInclude(data.subscription, { status: 'active', storedStatus: 'active' })
    assert.deepEqual(data.usage.employees, { used: 2, limit: 250 })

    await expectStatus(
      call(client, 'GET', '/organizations/00000000-0000-7000-8000-000000000000', support),
      404
    )
  })

  test('root changes a subscription, suspends and reactivates, audited', async ({
    client,
    assert,
  }) => {
    const root = await platformSession(client, 'root')
    const org = await createHrOrganization()
    const enterprise = await Plan.findByOrFail('code', 'enterprise')
    const end = DateTime.now().plus({ months: 2 }).startOf('second')

    const updated = await expectStatus(
      call(client, 'PATCH', `/organizations/${org.id}/subscription`, root).json({
        planId: enterprise.id,
        status: 'active',
        currentPeriodEnd: end.toISO(),
        maxEmployeesOverride: 500,
        modulesOverride: ['hr', 'talents'],
      }),
      200
    )
    assert.deepInclude(updated.body().data.subscription, {
      status: 'active',
      maxEmployeesOverride: 500,
      modulesOverride: ['hr', 'talents'],
    })
    const entitlements = await entitlementService.resolve(org.id)
    assert.deepEqual(entitlements!.modules, ['hr', 'talents'])

    const suspended = await expectStatus(
      call(client, 'POST', `/organizations/${org.id}/suspend`, root),
      200
    )
    assert.equal(suspended.body().data.subscription.status, 'suspended')
    const restricted = await entitlementService.resolve(org.id)
    assert.deepEqual(restricted!.readOnlyModules, ['hr'])
    await expectStatus(call(client, 'POST', `/organizations/${org.id}/suspend`, root), 409)

    const reactivated = await expectStatus(
      call(client, 'POST', `/organizations/${org.id}/reactivate`, root),
      200
    )
    assert.equal(reactivated.body().data.subscription.status, 'active')
    await expectStatus(call(client, 'POST', `/organizations/${org.id}/reactivate`, root), 409)

    const actions = await AuditLog.query()
      .where('organization_id', org.id)
      .whereIn('action', [
        'platform.subscription_updated',
        'platform.organization_suspended',
        'platform.organization_reactivated',
      ])
      .where('actor_user_id', root.user.id)
    assert.lengthOf(actions, 3)
    await expectStatus(
      call(client, 'PATCH', `/organizations/${org.id}/subscription`, root).json({ status: 'bad' }),
      422
    )
  })
})

test.group('Platform plans', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('root manages plans; support only reads', async ({ client, assert }) => {
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const body = {
      code: 'pme',
      name: 'PME',
      priceGnf: 900_000,
      maxEmployees: 100,
      aiCreditsPerMonth: 200,
      modules: ['hr', 'leaves'],
      isPublic: false,
    }

    await expectStatus(call(client, 'POST', '/plans', support).json(body), 403)
    const created = await expectStatus(call(client, 'POST', '/plans', root).json(body), 201)
    const plan = created.body().data
    assert.deepInclude(plan, {
      code: 'pme',
      priceMonthlyGnf: 900_000,
      priceYearlyGnf: 9_000_000,
      isPublic: false,
    })
    await expectStatus(call(client, 'POST', '/plans', root).json(body), 409)
    await expectStatus(call(client, 'POST', '/plans', root).json({ ...body, code: 'X!' }), 422)

    const updated = await expectStatus(
      call(client, 'PATCH', `/plans/${plan.id}`, root).json({ priceYearlyGnf: 8_000_000 }),
      200
    )
    assert.equal(updated.body().data.priceYearlyGnf, 8_000_000)

    const listed = await expectStatus(call(client, 'GET', '/plans', support), 200)
    assert.include(
      listed.body().data.map((row: { code: string }) => row.code),
      'pme'
    )

    await expectStatus(call(client, 'DELETE', `/plans/${plan.id}`, root), 204)
    const deleted = await Plan.findOrFail(plan.id)
    assert.isNotNull(deleted.deletedAt)
    assert.lengthOf(
      await AuditLog.query()
        .where('target_id', plan.id)
        .whereIn('action', ['plan.created', 'plan.updated', 'plan.deleted']),
      3
    )
  })

  test('a plan in use cannot be deleted', async ({ client, assert }) => {
    const root = await platformSession(client, 'root')
    await createRecruitingOrganization()
    const pro = await Plan.findByOrFail('code', 'pro')
    const refused = await expectStatus(call(client, 'DELETE', `/plans/${pro.id}`, root), 409)
    assert.equal(errorOf(refused).details[0].rule, 'inUse')
  })
})
