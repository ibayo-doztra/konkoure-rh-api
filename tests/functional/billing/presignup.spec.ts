import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import Invoice from '#models/invoice'
import Payment from '#models/payment'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import UserRole from '#models/user_role'
import { PaymentSucceededMail } from '#modules/billing/mails/payment_mails'
import entitlementService from '#modules/billing/services/entitlement_service'
import settlementService from '#modules/billing/services/settlement_service'
import { apiLogin, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'
import { fakeDjomy } from '#tests/helpers/billing'
import { errorOf, expectStatus } from '#tests/helpers/http'

async function payFirst(client: ApiClient, email: string, method = 'orange_money') {
  const pro = await Plan.findByOrFail('code', 'pro')
  const response = await expectStatus(
    client.post('/api/v1/public/payments/checkout').json({
      planId: pro.id,
      cycle: 'monthly',
      method,
      email,
      ...(method === 'card' ? {} : { payerPhone: '+224621000000' }),
    }),
    201
  )
  return response.body().data as {
    merchantReference: string
    claimToken: string
    expectedAmount: number
    redirectUrl: string | null
  }
}

async function signedUp(client: ApiClient, email: string) {
  const user = await createUser({ email, emailVerifiedAt: DateTime.now() })
  const { accessToken } = await apiLogin(client, email)
  return { user, accessToken }
}

const claim = (
  client: ApiClient,
  reference: string,
  accessToken: string,
  body: Record<string, unknown>
) =>
  client
    .post(`/api/v1/public/payments/${reference}/claim`)
    .bearerToken(accessToken)
    .json({ organizationName: 'Payée SARL', ...body })

test.group('Payment before sign-up', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('pay, follow the status, sign up and claim the paid plan', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const djomy = fakeDjomy()
    const paid = await payFirst(client, 'Fatou@Exemple.gn')
    assert.equal(paid.expectedAmount, 1_490_000)
    assert.match(paid.claimToken, /^clm_/)

    const payment = await Payment.findByOrFail('merchant_reference', paid.merchantReference)
    assert.isNull(payment.organizationId)
    assert.notEqual(payment.claimTokenHash, paid.claimToken)

    const status = (token?: string) => {
      const request = client.get(`/api/v1/public/payments/${paid.merchantReference}`)
      return token ? request.header('X-Claim-Token', token) : request
    }
    const pending = await expectStatus(status(paid.claimToken), 200)
    assert.deepInclude(pending.body().data, {
      status: 'pending',
      planCode: 'pro',
      emailMasked: 'F***@Exemple.gn',
      claimable: false,
    })
    await expectStatus(status(), 404)
    await expectStatus(status('clm_wrong-token-value'), 404)

    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }
    assert.equal(await settlementService.settle(paid.merchantReference), 'succeeded')
    const ready = await expectStatus(status(paid.claimToken), 200)
    assert.isTrue(ready.body().data.claimable)

    const payer = await signedUp(client, 'fatou@exemple.gn')
    const created = await expectStatus(
      claim(client, paid.merchantReference, payer.accessToken, { claimToken: paid.claimToken }),
      201
    )
    await djomy.drain()
    djomy.restore()
    const organizationId = created.body().data.id
    assert.deepInclude(created.body().data, { plan: 'pro', roles: ['owner'] })

    const subscription = await Subscription.query()
      .where('organization_id', organizationId)
      .firstOrFail()
    assert.deepInclude(subscription.$attributes, { status: 'active', trialEndsAt: null })
    const entitlements = await entitlementService.resolve(organizationId)
    assert.include(entitlements!.modules, 'recruitment')
    await payment.refresh()
    assert.equal(payment.organizationId, organizationId)
    assert.isNotNull(payment.claimedAt)
    assert.equal(payment.subscriptionId, subscription.id)
    const invoice = await Invoice.query().where('payment_id', payment.id).firstOrFail()
    assert.isNotNull(invoice.pdfPath)
    assert.isNotNull(
      await UserRole.query()
        .where('organization_id', organizationId)
        .where('user_id', payer.user.id)
        .where('role', 'owner')
        .first()
    )
    assert.isNotNull(
      await AuditLog.query()
        .where('target_id', payment.id)
        .where('action', 'payment.claimed')
        .first()
    )
    mails.assertQueuedCount(PaymentSucceededMail, 1)

    // Single use.
    const again = await expectStatus(
      claim(client, paid.merchantReference, payer.accessToken, { claimToken: paid.claimToken }),
      409
    )
    assert.equal(errorOf(again).code, 'E_CLAIM_INVALID')
  })

  test('refuses an unpaid, expired or foreign-e-mail claim', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const paid = await payFirst(client, 'awa@exemple.gn')
    const owner = await signedUp(client, 'awa@exemple.gn')
    const stranger = await signedUp(client, 'autre@exemple.gn')
    const body = { claimToken: paid.claimToken }

    const unpaid = await expectStatus(
      claim(client, paid.merchantReference, owner.accessToken, body),
      409
    )
    assert.equal(errorOf(unpaid).details[0].rule, 'notPaid')

    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }
    await settlementService.settle(paid.merchantReference)
    djomy.restore()

    const foreign = await expectStatus(
      claim(client, paid.merchantReference, stranger.accessToken, body),
      409
    )
    assert.equal(errorOf(foreign).details[0].rule, 'email')
    await expectStatus(
      claim(client, paid.merchantReference, owner.accessToken, { claimToken: 'clm_not-the-one' }),
      404
    )
    await expectStatus(
      client.post(`/api/v1/public/payments/${paid.merchantReference}/claim`).json(body),
      401
    )

    await Payment.query()
      .where('merchant_reference', paid.merchantReference)
      .update({ claimExpiresAt: DateTime.now().minus({ minutes: 1 }).toJSDate() })
    const expired = await expectStatus(
      claim(client, paid.merchantReference, owner.accessToken, body),
      409
    )
    assert.equal(errorOf(expired).details[0].rule, 'expired')
  })

  test('validates the public checkout; a card returns the portal', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const pro = await Plan.findByOrFail('code', 'pro')
    const post = (body: Record<string, unknown>) =>
      client.post('/api/v1/public/payments/checkout').json(body)

    await expectStatus(post({ planId: pro.id, cycle: 'monthly', method: 'card' }), 422)
    await expectStatus(
      post({ planId: pro.id, cycle: 'monthly', method: 'orange_money', email: 'a@b.gn' }),
      422
    )
    const card = await payFirst(client, 'carte@exemple.gn', 'card')
    djomy.restore()
    assert.equal(card.redirectUrl, 'https://pay.djomy.test/tx-1')
  })

  test('works under the application role (RLS)', async ({ client, assert }) => {
    const djomy = fakeDjomy()
    const paid = await payFirst(client, 'rls@exemple.gn')
    djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }
    const payer = await signedUp(client, 'rls@exemple.gn')

    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    assert.equal(await settlementService.settle(paid.merchantReference), 'succeeded')
    await expectStatus(
      claim(client, paid.merchantReference, payer.accessToken, { claimToken: paid.claimToken }),
      201
    )
    djomy.restore()
  })
})

/** A paid-first payment, settled, and its payer who already owns an organization. */
async function paidOwner(client: ApiClient, email: string) {
  const djomy = fakeDjomy()
  const paid = await payFirst(client, email)
  djomy.transactions['tx-1'] = { status: 'SUCCESS', paidAmount: 1_490_000 }
  await settlementService.settle(paid.merchantReference)
  const payer = await signedUp(client, email)
  const created = await expectStatus(
    client.post('/api/v1/organizations').bearerToken(payer.accessToken).json({ name: 'Keita SA' }),
    201
  )
  const organizationId = created.body().data.id as string
  return { djomy, paid, payer, organizationId }
}

const claimInto = (
  client: ApiClient,
  reference: string,
  accessToken: string,
  body: Record<string, unknown>
) => client.post(`/api/v1/public/payments/${reference}/claim`).bearerToken(accessToken).json(body)

const subscriptionsOf = (organizationId: string) =>
  Subscription.query().where('organization_id', organizationId).orderBy('created_at', 'asc')

test.group('Payment before sign-up into an existing organization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('replaces a trial with the paid plan from now', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const { djomy, paid, payer, organizationId } = await paidOwner(client, 'owner@exemple.gn')
    const [trial] = await subscriptionsOf(organizationId)
    assert.equal(trial.status, 'trialing')

    const response = await expectStatus(
      claimInto(client, paid.merchantReference, payer.accessToken, {
        claimToken: paid.claimToken,
        organizationId,
      }),
      201
    )
    await djomy.drain()
    djomy.restore()
    assert.deepInclude(response.body().data, {
      id: organizationId,
      name: 'Keita SA',
      plan: 'pro',
      roles: ['owner'],
    })

    const [before, after] = await subscriptionsOf(organizationId)
    assert.equal(before.id, trial.id)
    assert.equal(before.status, 'expired')
    assert.deepInclude(after.$attributes, { status: 'active', cycle: 'monthly' })
    const pro = await Plan.findByOrFail('code', 'pro')
    assert.equal(after.planId, pro.id)

    const payment = await Payment.findByOrFail('merchant_reference', paid.merchantReference)
    assert.equal(payment.organizationId, organizationId)
    assert.equal(payment.subscriptionId, after.id)
    assert.isNotNull(payment.claimedAt)
    const invoice = await Invoice.query().where('payment_id', payment.id).firstOrFail()
    assert.equal(invoice.organizationId, organizationId)
    assert.isNotNull(invoice.pdfPath)
    const audit = await AuditLog.query()
      .where('target_id', payment.id)
      .where('action', 'payment.claimed')
      .firstOrFail()
    assert.equal(audit.organizationId, organizationId)
    assert.include((await entitlementService.resolve(organizationId))!.modules, 'recruitment')
    mails.assertQueuedCount(PaymentSucceededMail, 1)

    const again = await expectStatus(
      claimInto(client, paid.merchantReference, payer.accessToken, {
        claimToken: paid.claimToken,
        organizationId,
      }),
      409
    )
    assert.equal(errorOf(again).details[0].rule, 'used')
  })

  test('extends a running period of the same plan and cycle', async ({ client, assert }) => {
    const { djomy, paid, payer, organizationId } = await paidOwner(client, 'renew@exemple.gn')
    const pro = await Plan.findByOrFail('code', 'pro')
    const [running] = await subscriptionsOf(organizationId)
    const end = DateTime.now().plus({ days: 10 }).startOf('second')
    running.merge({
      planId: pro.id,
      cycle: 'monthly',
      status: 'active',
      trialEndsAt: null,
      currentPeriodStart: DateTime.now().minus({ days: 20 }),
      currentPeriodEnd: end,
    })
    await running.save()

    await expectStatus(
      claimInto(client, paid.merchantReference, payer.accessToken, {
        claimToken: paid.claimToken,
        organizationId,
      }),
      201
    )
    await djomy.drain()
    djomy.restore()

    const subscriptions = await subscriptionsOf(organizationId)
    assert.lengthOf(subscriptions, 1)
    assert.equal(subscriptions[0].status, 'active')
    assert.equal(subscriptions[0].currentPeriodEnd.toMillis(), end.plus({ months: 1 }).toMillis())
    const invoice = await Invoice.query()
      .where('organization_id', organizationId)
      .whereNotNull('payment_id')
      .firstOrFail()
    assert.equal(invoice.periodStart.toMillis(), end.toMillis())
  })

  test('refuses an ambiguous body, a non-owner and another organization', async ({
    client,
    assert,
  }) => {
    const { djomy, paid, payer, organizationId } = await paidOwner(client, 'deny@exemple.gn')
    djomy.restore()
    const send = (body: Record<string, unknown>) =>
      claimInto(client, paid.merchantReference, payer.accessToken, {
        claimToken: paid.claimToken,
        ...body,
      })

    const both = await expectStatus(send({ organizationId, organizationName: 'Autre SA' }), 422)
    assert.equal(errorOf(both).details[0].rule, 'target')
    const neither = await expectStatus(send({}), 422)
    assert.equal(errorOf(neither).details[0].field, 'organizationName')
    await expectStatus(send({ organizationId: 'not-a-uuid' }), 422)

    // Member without the owner role.
    const other = await createOrganization('Autre')
    await grantRoles(payer.user, other, ['hr_admin'])
    await expectStatus(send({ organizationId: other.id }), 403)

    // Not a member, unknown, or deleted: nothing leaks.
    const foreign = await createOrganization('Etrangere')
    await expectStatus(send({ organizationId: foreign.id }), 404)
    await expectStatus(send({ organizationId: '019a0000-0000-7000-8000-000000000000' }), 404)
    const deleted = await createOrganization('Supprimee')
    await grantRoles(payer.user, deleted, ['owner'])
    deleted.deletedAt = DateTime.now()
    await deleted.save()
    await expectStatus(send({ organizationId: deleted.id }), 404)

    const payment = await Payment.findByOrFail('merchant_reference', paid.merchantReference)
    assert.isNull(payment.organizationId)
    assert.isNull(payment.claimedAt)
  })

  test('works under the application role (RLS)', async ({ client }) => {
    const { djomy, paid, payer, organizationId } = await paidOwner(client, 'rls2@exemple.gn')
    // The global test transaction keeps the tenant of POST /organizations; a
    // real request starts without one, as the pre-signup payment needs.
    await db.rawQuery(`select set_config('app.org_id', '', true)`)
    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    await expectStatus(
      claimInto(client, paid.merchantReference, payer.accessToken, {
        claimToken: paid.claimToken,
        organizationId,
      }),
      201
    )
    djomy.restore()
  })
})

test.group('GET /public/plans', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists the public plans without authentication', async ({ client, assert }) => {
    await Plan.create({
      code: 'hidden',
      name: 'Cachée',
      priceGnf: '1',
      maxEmployees: 1,
      isPublic: false,
    })
    const response = await expectStatus(client.get('/api/v1/public/plans'), 200)
    const codes = response.body().data.map((plan: { code: string }) => plan.code)
    assert.includeMembers(codes, ['free', 'starter', 'pro', 'enterprise'])
    assert.notInclude(codes, 'hidden')
    const pro = response.body().data.find((plan: { code: string }) => plan.code === 'pro')
    assert.deepInclude(pro, { priceMonthlyGnf: 1_490_000, priceYearlyGnf: 14_900_000 })
  })
})
