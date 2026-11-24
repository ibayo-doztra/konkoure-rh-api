import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Employee from '#models/employee'
import Invoice from '#models/invoice'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import Payment from '#models/payment'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import { PaymentSucceededMail } from '#modules/billing/mails/payment_mails'
import entitlementService from '#modules/billing/services/entitlement_service'
import settlementService from '#modules/billing/services/settlement_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { DJOMY_PATH_TOKEN, djomySignature, fakeDjomy } from '#tests/helpers/billing'
import { createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createRecruitingOrganization } from '#tests/helpers/recruitment'

const currentOf = (organization: Organization) =>
  Subscription.query()
    .where('organization_id', organization.id)
    .orderBy('created_at', 'desc')
    .firstOrFail()

const planOf = (code: string) => Plan.findByOrFail('code', code)

/** The organization's plan becomes `code`, active from `start` to `end`. */
async function setPlan(organization: Organization, code: string, start: DateTime, end: DateTime) {
  const plan = await planOf(code)
  const subscription = await currentOf(organization)
  subscription.merge({
    planId: plan.id,
    status: 'active',
    trialEndsAt: null,
    currentPeriodStart: start,
    currentPeriodEnd: end,
  })
  await subscription.save()
  await entitlementService.invalidate(organization.id)
  return subscription
}

function webhook(client: Parameters<typeof orgCall>[0], body: unknown, token = DJOMY_PATH_TOKEN) {
  const raw = JSON.stringify(body)
  return client
    .post(`/api/v1/webhooks/djomy/${token}`)
    .header('Content-Type', 'application/json')
    .header('X-Webhook-Signature', djomySignature(raw))
    .json(body)
}

test.group('POST /org/billing/checkout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('opens a mobile money payment priced by the server', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const pro = await planOf('pro')

    const response = await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json({
        planId: pro.id,
        cycle: 'monthly',
        method: 'orange_money',
        payerPhone: '+224621000000',
        expectedAmount: 1,
      }),
      201
    )
    djomy.restore()
    const data = response.body().data
    assert.deepInclude(data, {
      status: 'pending',
      expectedAmount: 1_490_000,
      currency: 'GNF',
      redirectUrl: null,
    })
    assert.isString(data.instructions)

    const payment = await Payment.findOrFail(data.paymentId)
    assert.equal(payment.providerTransactionId, 'tx-1')
    const charge = djomy.calls.find((call) => call.path === '/v1/payments')!
    assert.deepInclude(charge.body!, {
      amount: 1_490_000,
      paymentMethod: 'OM',
      payerIdentifier: '+224621000000',
      merchantPaymentReference: payment.merchantReference,
    })
  })

  test('a card payment returns the Djomy portal; yearly is 10 months', async ({
    client,
    assert,
  }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const starter = await planOf('starter')

    const response = await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json({
        planId: starter.id,
        cycle: 'yearly',
        method: 'card',
      }),
      201
    )
    djomy.restore()
    assert.deepInclude(response.body().data, {
      expectedAmount: 4_900_000,
      instructions: null,
      redirectUrl: 'https://pay.djomy.test/tx-1',
    })
  })

  test('validates the request and refuses other roles', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const hr = await hrSession(client, org, ['hr_admin'])
    const pro = await planOf('pro')
    const free = await planOf('free')
    const post = (who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/billing/checkout', who, org).json(body)

    await expectStatus(post(hr, { planId: pro.id, cycle: 'monthly', method: 'card' }), 403)
    const phone = await expectStatus(
      post(owner, { planId: pro.id, cycle: 'monthly', method: 'mtn_momo' }),
      422
    )
    assert.equal(errorOf(phone).details[0].field, 'payerPhone')
    await expectStatus(
      post(owner, { planId: pro.id, cycle: 'monthly', method: 'mtn_momo', payerPhone: '0612' }),
      422
    )
    await expectStatus(post(owner, { planId: free.id, cycle: 'monthly', method: 'card' }), 422)
    await expectStatus(post(owner, { planId: pro.id, cycle: 'weekly', method: 'card' }), 422)
    djomy.restore()
    assert.lengthOf(djomy.calls, 0)
  })

  test('a provider outage fails the payment with 503', async ({ client, assert }) => {
    const djomy = fakeDjomy({ failPayments: true })
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const pro = await planOf('pro')

    await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json({
        planId: pro.id,
        cycle: 'monthly',
        method: 'card',
      }),
      503
    )
    djomy.restore()
    const payment = await Payment.query().where('organization_id', org.id).firstOrFail()
    assert.deepInclude(payment.$attributes, {
      status: 'failed',
      failureReason: 'provider_unavailable',
    })
  })

  test('an upgrade pays the target period minus the unused share', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const now = DateTime.now()
    // Half of a 30-day starter period left: credit 245 000 GNF.
    await setPlan(org, 'starter', now.minus({ days: 15 }), now.plus({ days: 15 }))
    const pro = await planOf('pro')

    const response = await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json({
        planId: pro.id,
        cycle: 'monthly',
        method: 'card',
      }),
      201
    )
    djomy.restore()
    assert.closeTo(response.body().data.expectedAmount, 1_490_000 - 245_000, 1_000)
  })

  test('a downgrade is scheduled at the term, unless the headcount is too high', async ({
    client,
    assert,
  }) => {
    const djomy = fakeDjomy()
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const starter = await planOf('starter')
    const body = { planId: starter.id, cycle: 'monthly', method: 'card' }

    const scheduled = await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json(body),
      200
    )
    assert.deepInclude(scheduled.body().data, {
      scheduled: true,
      planId: starter.id,
      cycle: 'monthly',
    })
    const subscription = await currentOf(org)
    assert.equal(subscription.scheduledPlanId, starter.id)
    assert.equal(scheduled.body().data.effectiveAt, subscription.currentPeriodEnd.toUTC().toISO())
    assert.lengthOf(await Payment.query().where('organization_id', org.id), 0)

    await Employee.createMany(
      Array.from({ length: 50 }, (_, index) => ({
        organizationId: org.id,
        firstName: 'Agent',
        lastName: `N${index}`,
      }))
    )
    const refused = await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json(body),
      403
    )
    djomy.restore()
    assert.equal(errorOf(refused).code, 'E_QUOTA_EXCEEDED')
    assert.equal(errorOf(refused).details[0].rule, '1')
  })
})

test.group('Djomy webhook and settlement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  async function openPayment(
    client: Parameters<typeof orgCall>[0],
    org: Organization,
    owner: { accessToken: string },
    code = 'pro'
  ) {
    const plan = await planOf(code)
    const response = await expectStatus(
      orgCall(client, 'POST', '/billing/checkout', owner, org).json({
        planId: plan.id,
        cycle: 'monthly',
        method: 'orange_money',
        payerPhone: '+224621000000',
      }),
      201
    )
    return Payment.findOrFail(response.body().data.paymentId)
  }

  test('a signed webhook confirmed by Djomy activates the plan', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const payment = await openPayment(client, org, owner)
    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }

    const event = {
      eventId: 'evt-1',
      eventType: 'payment.success',
      data: { merchantPaymentReference: payment.merchantReference, transactionId: 'tx-1' },
    }
    const first = await expectStatus(webhook(client, event), 200)
    assert.deepEqual(first.body().data, { received: true, duplicate: false })
    await djomy.drain()
    const replay = await expectStatus(webhook(client, event), 200)
    assert.deepEqual(replay.body().data, { received: true, duplicate: true })
    djomy.restore()

    await payment.refresh()
    assert.equal(payment.status, 'succeeded')
    assert.equal(Number(payment.paidAmount), 1_490_000)
    const subscription = await currentOf(org)
    assert.equal(subscription.planId, payment.planId)
    assert.equal(subscription.status, 'active')
    assert.equal(payment.subscriptionId, subscription.id)
    const entitlements = await entitlementService.resolve(org.id)
    assert.include(entitlements!.modules, 'recruitment')

    const invoice = await Invoice.query().where('payment_id', payment.id).firstOrFail()
    assert.match(invoice.number, /^KNK-\d{4}-\d{6}$/)
    assert.isNotNull(invoice.pdfPath)
    assert.isTrue(await drive.use('s3').exists(invoice.pdfPath!))
    const pdf = await expectStatus(
      orgCall(client, 'GET', `/billing/invoices/${invoice.id}/pdf`, owner, org),
      200
    )
    assert.equal(pdf.body().data.expiresIn, 900)

    mails.assertQueuedCount(PaymentSucceededMail, 1)
    assert.lengthOf(
      await Notification.query()
        .where('organization_id', org.id)
        .where('type', 'payment.succeeded'),
      1
    )
    assert.isNotNull(
      await AuditLog.query()
        .where('target_id', payment.id)
        .where('action', 'payment.succeeded')
        .first()
    )
  })

  test('an invalid token or signature is refused', async ({ client }) => {
    const body = { data: { merchantPaymentReference: 'x' } }
    await expectStatus(webhook(client, body, 'wrong-token'), 401)
    await expectStatus(
      client
        .post(`/api/v1/webhooks/djomy/${DJOMY_PATH_TOKEN}`)
        .header('X-Webhook-Signature', 'v1:deadbeef')
        .json(body),
      401
    )
  })

  test('the webhook alone never activates: Djomy says pending or underpaid', async ({
    client,
    assert,
  }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const payment = await openPayment(client, org, owner)
    const before = await currentOf(org)

    // The event claims success, Djomy still reports the transaction pending.
    const claimed = {
      eventId: 'evt-claim',
      data: { merchantPaymentReference: payment.merchantReference, status: 'SUCCESS' },
    }
    await expectStatus(webhook(client, claimed), 200)
    await djomy.drain()
    await payment.refresh()
    assert.equal(payment.status, 'pending')

    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_000_000 }
    await settlementService.settle(payment.merchantReference)
    djomy.restore()
    await payment.refresh()
    assert.deepInclude(payment.$attributes, { status: 'failed', failureReason: 'amount_mismatch' })
    const unchanged = await currentOf(org)
    assert.equal(unchanged.id, before.id)
    const failures = await Notification.query()
      .where('organization_id', org.id)
      .where('type', 'payment.failed')
    assert.lengthOf(failures, 1)
  })

  test('settlement works under the application role (RLS)', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const payment = await openPayment(client, org, owner)
    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }

    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    assert.equal(await settlementService.settle(payment.merchantReference), 'succeeded')
    djomy.restore()
  })

  test('a renewal of the running plan extends the period', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const now = DateTime.now()
    const running = await setPlan(org, 'pro', now.minus({ days: 20 }), now.plus({ days: 10 }))
    const payment = await openPayment(client, org, owner)
    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }

    await settlementService.settle(payment.merchantReference)
    djomy.restore()

    const after = await currentOf(org)
    assert.equal(after.id, running.id)
    assert.equal(
      after.currentPeriodEnd.toISO(),
      running.currentPeriodEnd.plus({ months: 1 }).toISO()
    )
  })

  test('pending payments are polled, expired after 30 minutes, then reconciled', async ({
    client,
    assert,
  }) => {
    const djomy = fakeDjomy()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const polled = await openPayment(client, org, owner)
    const stale = await openPayment(client, org, owner)
    djomy.transactions['tx-1'] = { status: 'FAILED' }

    assert.equal(await settlementService.pollPending(), 1)
    await polled.refresh()
    assert.deepInclude(polled.$attributes, { status: 'failed', failureReason: 'provider_failed' })

    assert.equal(await settlementService.expirePending(DateTime.now().plus({ minutes: 31 })), 1)
    await stale.refresh()
    assert.equal(stale.status, 'expired')

    // A late success never activates anything; it is flagged for reconciliation.
    djomy.transactions['tx-2'] = { status: 'SUCCESS', paidAmount: 1_490_000 }
    assert.equal(await settlementService.settle(stale.merchantReference), 'late')
    await stale.refresh()
    assert.deepInclude(stale.$attributes, { status: 'expired', failureReason: 'late_success' })
    const kept = await currentOf(org)
    assert.notEqual(kept.planId, stale.planId)

    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }
    assert.equal(await settlementService.reconcile(), 1)
    djomy.restore()
    await polled.refresh()
    assert.equal(polled.failureReason, 'remote_succeeded')
  })

  test('an invoice of another organization is not found; no PDF yet is 409', async ({ client }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const make = async (organization: Organization, number: string) => {
      const subscription = await currentOf(organization)
      return Invoice.create({
        organizationId: organization.id,
        subscriptionId: subscription.id,
        number,
        amount: '1490000',
        issuedAt: DateTime.now(),
        periodStart: DateTime.now(),
        periodEnd: DateTime.now().plus({ months: 1 }),
      })
    }
    const own = await make(org, 'KNK-2026-900001')
    const foreign = await make(other, 'KNK-2026-900002')

    await expectStatus(orgCall(client, 'GET', `/billing/invoices/${own.id}/pdf`, owner, org), 409)
    await expectStatus(
      orgCall(client, 'GET', `/billing/invoices/${foreign.id}/pdf`, owner, org),
      404
    )
  })
})
