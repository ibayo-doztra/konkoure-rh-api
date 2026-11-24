import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import DemoRequest from '#models/demo_request'
import type Organization from '#models/organization'
import Payment from '#models/payment'
import Plan from '#models/plan'
import PlatformAdmin from '#models/platform_admin'
import PlatformSetting from '#models/platform_setting'
import Subscription from '#models/subscription'
import SystemLog from '#models/system_log'
import entitlementService from '#modules/billing/services/entitlement_service'
import systemLogService from '#shared/logging/system_log_service'
import { newId } from '#shared/utils/crypto'
import { apiLogin, createUser } from '#tests/helpers/auth'
import { fakeDjomy } from '#tests/helpers/billing'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createHrOrganization } from '#tests/helpers/hr'

async function platformSession(client: ApiClient, level: 'root' | 'support') {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  await PlatformAdmin.create({ userId: user.id, level })
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

const call = (client: ApiClient, method: string, path: string, who: { accessToken: string }) =>
  client.request(`/api/v1/platform${path}`, method).bearerToken(who.accessToken)

async function createPayment(organization: Organization | null, overrides: Partial<Payment> = {}) {
  const plan = await Plan.findByOrFail('code', 'pro')
  return Payment.create({
    organizationId: organization?.id ?? null,
    planId: plan.id,
    cycle: 'monthly',
    merchantReference: newId(),
    expectedAmount: '1490000',
    method: 'orange_money',
    ...overrides,
  })
}

test.group('Platform settings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('root opens every module for testing; secrets are never shown', async ({
    client,
    assert,
  }) => {
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    await PlatformSetting.create({ key: 'test_secret', value: 'hunter2', isSecret: true })
    const org = await createHrOrganization()

    const listed = await expectStatus(call(client, 'GET', '/settings', support), 200)
    const byKey = Object.fromEntries(
      listed.body().data.map((row: { key: string }) => [row.key, row])
    )
    assert.deepInclude(byKey.modules_open_for_testing, { value: false, isSecret: false })
    assert.deepInclude(byKey.test_secret, { value: null, isSecret: true })

    const body = { settings: [{ key: 'modules_open_for_testing', value: true }] }
    await expectStatus(call(client, 'PUT', '/settings', support).json(body), 403)
    await expectStatus(
      call(client, 'PUT', '/settings', root).json({ settings: [{ key: 'nope', value: 1 }] }),
      422
    )
    await expectStatus(
      call(client, 'PUT', '/settings', root).json({
        settings: [{ key: 'modules_open_for_testing', value: 'yes' }],
      }),
      422
    )
    await expectStatus(call(client, 'PUT', '/settings', root).json(body), 200)

    await entitlementService.invalidate(org.id)
    const entitlements = await entitlementService.resolve(org.id)
    assert.includeMembers(entitlements!.modules, ['recruitment', 'talents', 'api'])
    assert.isNotNull(await AuditLog.query().where('action', 'platform_setting.updated').first())
  })
})

test.group('Platform payments', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('support lists payments; root reconciles a late success once', async ({
    client,
    assert,
  }) => {
    const djomy = fakeDjomy()
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const org = await createHrOrganization()
    const late = await createPayment(org, {
      status: 'expired',
      failureReason: 'late_success',
      providerTransactionId: 'tx-late',
    })
    await createPayment(null, { status: 'pending' })
    djomy.transactions['tx-late'] = { status: 'SUCCESS', paidAmount: 1_490_000 }

    const listed = await expectStatus(
      call(client, 'GET', '/payments?filter[failureReason]=late_success', support),
      200
    )
    assert.deepEqual(
      listed.body().data.map((row: { id: string }) => row.id),
      [late.id]
    )
    await expectStatus(call(client, 'POST', `/payments/${late.id}/reconcile`, support), 403)

    const reconciled = await expectStatus(
      call(client, 'POST', `/payments/${late.id}/reconcile`, root),
      200
    )
    await djomy.drain()
    assert.equal(reconciled.body().data.outcome, 'succeeded')
    assert.equal(reconciled.body().data.payment.status, 'succeeded')
    const subscription = await Subscription.query()
      .where('organization_id', org.id)
      .orderBy('created_at', 'desc')
      .firstOrFail()
    assert.equal(subscription.planId, late.planId)
    assert.equal(subscription.status, 'active')

    const again = await expectStatus(
      call(client, 'POST', `/payments/${late.id}/reconcile`, root),
      200
    )
    djomy.restore()
    assert.equal(again.body().data.outcome, 'already_settled')
    assert.lengthOf(
      await AuditLog.query().where('target_id', late.id).where('action', 'payment.reconciled'),
      1
    )
  })

  test('a payment Djomy does not confirm is not reconciled', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const root = await platformSession(client, 'root')
    const org = await createHrOrganization()
    const failed = await createPayment(org, { status: 'failed', providerTransactionId: 'tx-no' })
    djomy.transactions['tx-no'] = { status: 'FAILED' }
    const refused = await expectStatus(
      call(client, 'POST', `/payments/${failed.id}/reconcile`, root),
      409
    )
    djomy.restore()
    assert.equal(errorOf(refused).details[0].rule, 'notPaid')
  })
})

test.group('Demo requests', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the public form stores a request that support follows up', async ({ client, assert }) => {
    mail.fake()
    const support = await platformSession(client, 'support')
    const body = {
      fullName: 'Aminata Camara',
      email: 'aminata@entreprise.gn',
      phone: '+224 621 00 00 00',
      companyName: 'Entreprise SA',
      companySize: '50-200',
      message: 'Nous voulons tester le pointage NFC.',
    }
    await expectStatus(client.post('/api/v1/public/demo-requests').json({}), 422)
    const created = await expectStatus(client.post('/api/v1/public/demo-requests').json(body), 201)
    const request = await DemoRequest.findOrFail(created.body().data.id)
    assert.deepInclude(request.$attributes, { status: 'new', companyName: 'Entreprise SA' })

    const listed = await expectStatus(
      call(client, 'GET', '/demo-requests?filter[status]=new', support),
      200
    )
    assert.include(
      listed.body().data.map((row: { id: string }) => row.id),
      request.id
    )
    const updated = await expectStatus(
      call(client, 'PATCH', `/demo-requests/${request.id}`, support).json({
        status: 'contacted',
        assignedTo: support.user.id,
      }),
      200
    )
    assert.deepInclude(updated.body().data, { status: 'contacted', assignedTo: support.user.id })
    const outsider = await createUser()
    await expectStatus(
      call(client, 'PATCH', `/demo-requests/${request.id}`, support).json({
        assignedTo: outsider.id,
      }),
      422
    )
  })
})

test.group('Platform journals and health', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('journals are paged by cursor and filtered', async ({ client, assert }) => {
    const support = await platformSession(client, 'support')
    for (let index = 0; index < 3; index++) {
      await systemLogService.write({
        channel: 'test-channel',
        level: 'error',
        message: `Erreur ${index}`,
      })
    }
    await systemLogService.write({ channel: 'test-channel', level: 'info', message: 'Info' })

    const first = await expectStatus(
      call(
        client,
        'GET',
        '/logs/system?limit=2&filter[channel]=test-channel&filter[level]=error',
        support
      ),
      200
    )
    assert.lengthOf(first.body().data, 2)
    assert.equal(first.body().data[0].channel, 'test-channel')
    const cursor = first.body().meta.nextCursor
    assert.isString(cursor)
    const second = await expectStatus(
      call(
        client,
        'GET',
        `/logs/system?limit=2&filter[channel]=test-channel&filter[level]=error&cursor=${cursor}`,
        support
      ),
      200
    )
    assert.lengthOf(second.body().data, 1)
    assert.isNull(second.body().meta.nextCursor)

    await expectStatus(call(client, 'GET', '/logs/audit?limit=501', support), 422)
    await expectStatus(call(client, 'GET', '/logs/audit?cursor=bad', support), 422)
    await expectStatus(call(client, 'GET', '/logs/nope', support), 422)
    await expectStatus(call(client, 'GET', '/logs/usage', support), 200)
  })

  test('health reports the probes and integrations; old system logs are purged', async ({
    client,
    assert,
  }) => {
    const support = await platformSession(client, 'support')
    const health = await expectStatus(call(client, 'GET', '/health', support), 200)
    assert.deepInclude(health.body().data.checks, { database: 'ok', redis: 'ok' })
    assert.deepEqual(health.body().data.integrations, { djomy: 'configured', ai: 'configured' })

    const old = await SystemLog.create({
      channel: 'jobs',
      level: 'error',
      message: 'Ancienne',
      context: {},
      createdAt: DateTime.now().minus({ days: 31 }),
    })
    await systemLogService.purge()
    assert.isNull(await SystemLog.find(old.id))
  })
})
