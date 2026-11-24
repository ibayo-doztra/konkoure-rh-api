import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Invoice from '#models/invoice'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import Payment from '#models/payment'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import UsageCounter from '#models/usage_counter'
import billingService from '#modules/billing/services/billing_service'
import entitlementService from '#modules/billing/services/entitlement_service'
import lifecycleService from '#modules/billing/services/subscription_lifecycle_service'
import { newId } from '#shared/utils/crypto'
import { TenantContext } from '#shared/tenant/tenant_context'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createRecruitingOrganization } from '#tests/helpers/recruitment'

const currentOf = (organization: Organization) =>
  Subscription.query()
    .where('organization_id', organization.id)
    .orderBy('created_at', 'desc')
    .firstOrFail()

async function createPayment(organization: Organization, overrides: Partial<Payment> = {}) {
  const plan = await Plan.findByOrFail('code', 'pro')
  return Payment.create({
    organizationId: organization.id,
    planId: plan.id,
    cycle: 'monthly',
    merchantReference: newId(),
    expectedAmount: '1490000',
    method: 'orange_money',
    ...overrides,
  })
}

test.group('/org/billing read side', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('owners read subscription, plans and usage; other roles are refused', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const hr = await hrSession(client, org, ['hr_admin'])
    await createEmployee(org)
    const current = await currentOf(org)
    await UsageCounter.create({
      organizationId: org.id,
      period: DateTime.now().toUTC().toFormat('yyyy-MM'),
      metric: 'ai_credits',
      used: 12,
    })

    const subscription = await expectStatus(
      orgCall(client, 'GET', '/billing/subscription', owner, org),
      200
    )
    assert.deepInclude(subscription.body().data, {
      id: current.id,
      status: 'active',
      cycle: 'monthly',
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
    })
    assert.equal(subscription.body().data.plan.code, 'pro')

    const plans = await expectStatus(orgCall(client, 'GET', '/billing/plans', owner, org), 200)
    const pro = plans.body().data.find((plan: { code: string }) => plan.code === 'pro')
    assert.deepInclude(pro, { priceMonthlyGnf: 1_490_000, priceYearlyGnf: 14_900_000 })

    const usage = await expectStatus(orgCall(client, 'GET', '/billing/usage', owner, org), 200)
    assert.deepEqual(usage.body().data.employees, { used: 3, limit: 250 })
    assert.deepEqual(usage.body().data.aiCredits, { used: 12, limit: 500 })

    for (const path of ['/billing/subscription', '/billing/plans', '/billing/usage']) {
      await expectStatus(orgCall(client, 'GET', path, hr, org), 403)
    }
  })

  test('lists payments and invoices of the organization only', async ({ client, assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const payment = await createPayment(org, { status: 'succeeded', paidAmount: '1490000' })
    await createPayment(org, { status: 'failed' })
    const foreign = await createPayment(other)
    const subscription = await currentOf(org)
    await Invoice.create({
      organizationId: org.id,
      subscriptionId: subscription.id,
      paymentId: payment.id,
      number: 'KNK-2026-000001',
      amount: '1490000',
      issuedAt: DateTime.now(),
      periodStart: DateTime.now(),
      periodEnd: DateTime.now().plus({ months: 1 }),
    })

    const list = await expectStatus(
      orgCall(client, 'GET', '/billing/payments?filter[status]=succeeded', owner, org),
      200
    )
    assert.deepEqual(
      list.body().data.map((row: { id: string }) => row.id),
      [payment.id]
    )
    const shown = await expectStatus(
      orgCall(client, 'GET', `/billing/payments/${payment.id}`, owner, org),
      200
    )
    assert.deepInclude(shown.body().data, {
      status: 'succeeded',
      expectedAmount: 1_490_000,
      paidAmount: 1_490_000,
      currency: 'GNF',
    })
    await expectStatus(orgCall(client, 'GET', `/billing/payments/${foreign.id}`, owner, org), 404)

    const invoices = await expectStatus(
      orgCall(client, 'GET', '/billing/invoices', owner, org),
      200
    )
    assert.deepInclude(invoices.body().data[0], {
      number: 'KNK-2026-000001',
      amount: 1_490_000,
      hasPdf: false,
    })
    assert.equal(invoices.body().meta.total, 1)
  })

  test('an expired organization keeps access to billing', async ({ client, assert }) => {
    const org = await createHrOrganization('Expirée')
    const owner = await hrSession(client, org, ['owner'])
    const subscription = await currentOf(org)
    subscription.trialEndsAt = DateTime.now().minus({ days: 1 })
    await subscription.save()
    await entitlementService.invalidate(org.id)

    const response = await expectStatus(
      orgCall(client, 'GET', '/billing/subscription', owner, org),
      200
    )
    assert.equal(response.body().data.status, 'expired')
    await expectStatus(orgCall(client, 'GET', '/billing/plans', owner, org), 200)
  })
})

test.group('POST /org/billing/cancel and /resume', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('cancels at the term and resumes before it', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const hr = await hrSession(client, org, ['hr_admin'])
    await expectStatus(orgCall(client, 'POST', '/billing/cancel', hr, org), 403)

    const canceled = await expectStatus(orgCall(client, 'POST', '/billing/cancel', owner, org), 200)
    assert.deepInclude(canceled.body().data, { status: 'canceled', cancelAtPeriodEnd: true })
    assert.isNotNull(canceled.body().data.canceledAt)

    // Access is kept until the end of the period.
    const entitlements = await entitlementService.resolve(org.id)
    assert.include(entitlements!.modules, 'recruitment')

    await expectStatus(orgCall(client, 'POST', '/billing/cancel', owner, org), 409)
    const resumed = await expectStatus(orgCall(client, 'POST', '/billing/resume', owner, org), 200)
    assert.deepInclude(resumed.body().data, {
      status: 'active',
      cancelAtPeriodEnd: false,
      canceledAt: null,
    })
    await expectStatus(orgCall(client, 'POST', '/billing/resume', owner, org), 409)

    const actions = await AuditLog.query()
      .where('organization_id', org.id)
      .whereIn('action', ['subscription.canceled', 'subscription.resumed'])
    assert.lengthOf(actions, 2)
  })

  test('a trial cannot be canceled', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const refused = await expectStatus(orgCall(client, 'POST', '/billing/cancel', owner, org), 409)
    assert.equal(errorOf(refused).details[0].rule, 'notCancelable')
  })
})

test.group('subscriptions:lifecycle', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('persists the end of trial, past_due, expired and canceled terms', async ({ assert }) => {
    const trial = await createHrOrganization('Essai')
    const late = await createRecruitingOrganization('Retard')
    const lapsed = await createRecruitingOrganization('Échue')
    const canceled = await createRecruitingOrganization('Annulée')
    const now = DateTime.now()

    const trialSubscription = await currentOf(trial)
    trialSubscription.trialEndsAt = now.minus({ hours: 1 })
    await trialSubscription.save()
    const lateSubscription = await currentOf(late)
    lateSubscription.currentPeriodEnd = now.minus({ days: 2 })
    await lateSubscription.save()
    const lapsedSubscription = await currentOf(lapsed)
    lapsedSubscription.merge({ status: 'past_due', currentPeriodEnd: now.minus({ days: 8 }) })
    await lapsedSubscription.save()
    const canceledSubscription = await currentOf(canceled)
    canceledSubscription.merge({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: now.minus({ minutes: 5 }),
    })
    await canceledSubscription.save()

    await lifecycleService.run(now)

    const statuses = await Promise.all([trial, late, lapsed].map((row) => currentOf(row)))
    assert.deepEqual(
      statuses.map((row) => row.status),
      ['expired', 'past_due', 'expired']
    )
    const ended = await currentOf(canceled)
    assert.equal(ended.status, 'expired')
    assert.isFalse(ended.cancelAtPeriodEnd)
    assert.isNotNull(
      await AuditLog.query()
        .where('organization_id', trial.id)
        .where('action', 'subscription.lifecycle')
        .first()
    )
  })

  test('applies a scheduled plan at the term', async ({ assert }) => {
    const org = await createRecruitingOrganization()
    const starter = await Plan.findByOrFail('code', 'starter')
    const subscription = await currentOf(org)
    subscription.merge({
      scheduledPlanId: starter.id,
      scheduledCycle: 'yearly',
      currentPeriodEnd: DateTime.now().minus({ minutes: 1 }),
    })
    await subscription.save()

    await lifecycleService.run()

    const after = await currentOf(org)
    assert.equal(after.planId, starter.id)
    assert.equal(after.cycle, 'yearly')
    assert.isNull(after.scheduledPlanId)
    assert.equal(after.status, 'past_due')
  })

  test('tells the owners 7 days and 1 day before the end of the trial, once', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    await hrSession(client, org, ['hr_admin'])
    const subscription = await currentOf(org)
    const now = DateTime.fromISO('2026-11-24T10:00:00Z')
    subscription.trialEndsAt = now.plus({ days: 7 })
    await subscription.save()

    await lifecycleService.run(now)
    await lifecycleService.run(now)

    const notifications = await Notification.query()
      .where('organization_id', org.id)
      .where('type', 'trial.ending')
    assert.lengthOf(notifications, 1)
    assert.equal(notifications[0].userId, owner.user.id)
    assert.include(notifications[0].body, '7')

    subscription.trialEndsAt = now.plus({ days: 3 })
    await subscription.save()
    await lifecycleService.run(now)
    assert.lengthOf(
      await Notification.query().where('organization_id', org.id).where('type', 'trial.ending'),
      1
    )
  })
})

test.group('Billing under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('RLS hides other tenants and pre-signup payments', async ({ assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const own = await createPayment(org)
    await createPayment(other)
    const plan = await Plan.findByOrFail('code', 'pro')
    await Payment.create({
      organizationId: null,
      planId: plan.id,
      cycle: 'monthly',
      merchantReference: newId(),
      expectedAmount: '1490000',
    })

    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const page = await billingService.payments(new TenantContext(org.id, ['owner']), {
      page: 1,
      perPage: 25,
    })
    assert.deepEqual(
      page.all().map((row) => row.id),
      [own.id]
    )
    const { rows } = await db.rawQuery('SELECT count(*)::int AS total FROM payments')
    assert.equal(rows[0].total, 1)
  })
})
