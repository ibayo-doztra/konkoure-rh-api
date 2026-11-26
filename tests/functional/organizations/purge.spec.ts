import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import Invoice from '#models/invoice'
import type Organization from '#models/organization'
import Payment from '#models/payment'
import Plan from '#models/plan'
import PlatformAdmin from '#models/platform_admin'
import StoredFile from '#models/stored_file'
import Subscription from '#models/subscription'
import User from '#models/user'
import {
  KEPT_TABLES,
  PURGED_NAME,
  PURGED_TABLES,
} from '#modules/organizations/repositories/organization_purge_repository'
import organizationPurgeService from '#modules/organizations/services/organization_purge_service'
import { newId } from '#shared/utils/crypto'
import { apiLogin, createUser } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'

const nextMonday = () => {
  const today = DateTime.now().setZone('Africa/Conakry').startOf('day')
  return today.plus({ days: 8 - today.weekday })
}

async function deletedSince(organization: Organization, days: number) {
  organization.merge({ deletedAt: DateTime.now().minus({ days }) })
  await organization.save()
}

/** Organization with members, HR data, a leave, a file, a payment and its invoice. */
async function populated(client: ApiClient, name = 'Doztra') {
  const org = await createHrOrganization(name)
  const owner = await hrSession(client, org, ['owner'])
  const employee = await hrSession(client, org, ['employee'], { managerId: owner.employee!.id })
  const from = nextMonday()
  await expectStatus(
    orgCall(client, 'POST', '/leaves', employee, org).json({
      type: 'annual',
      startDate: from.toISODate(),
      endDate: from.plus({ days: 1 }).toISODate(),
    }),
    201
  )
  const path = `${org.id}/contract/${newId()}/${newId()}.pdf`
  await drive.use('s3').put(path, 'x')
  await drive.use('s3Public').put(`${org.id}/organization/${org.id}/logo.png`, 'x')
  await StoredFile.create({
    organizationId: org.id,
    bucket: 'private-docs',
    path,
    mime: 'application/pdf',
    sizeBytes: 1,
    checksumSha256: 'x'.repeat(64),
    ownerType: 'contract',
    ownerId: newId(),
    visibility: 'private',
  })

  const plan = await Plan.findByOrFail('code', 'pro')
  const subscription = await Subscription.query().where('organization_id', org.id).firstOrFail()
  const payment = await Payment.create({
    organizationId: org.id,
    planId: plan.id,
    cycle: 'monthly',
    merchantReference: newId(),
    expectedAmount: '1490000',
    method: 'orange_money',
  })
  await Invoice.create({
    organizationId: org.id,
    subscriptionId: subscription.id,
    paymentId: payment.id,
    number: `KNK-2026-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
    amount: '1490000',
    issuedAt: DateTime.now(),
    periodStart: DateTime.now(),
    periodEnd: DateTime.now().plus({ months: 1 }),
    pdfPath: `invoices/${org.id}/invoice.pdf`,
  })
  await drive.use('s3').put(`invoices/${org.id}/invoice.pdf`, 'pdf')
  return { org, owner, employee, path }
}

async function rowsOf(table: string, organizationId: string) {
  const result = await db.rawQuery(
    `SELECT count(*)::int AS count FROM ${table} WHERE organization_id = ?`,
    [organizationId]
  )
  return result.rows[0].count as number
}

test.group('organizations.purge', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    drive.fake('s3Public')
    return () => {
      drive.restore('s3')
      drive.restore('s3Public')
    }
  })

  test('every table with an organization_id is either purged or kept', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT c.relname AS name FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE a.attname = 'organization_id' AND n.nspname = 'public'
          AND c.relkind IN ('r', 'p') AND NOT c.relispartition AND NOT a.attisdropped`
    )
    const tables = (result.rows as { name: string }[]).map((row) => row.name).sort()
    assert.deepEqual(tables, [...PURGED_TABLES, ...KEPT_TABLES].sort())
  })

  test('30 days after deletion: tenant data and files go, accounting and audit stay', async ({
    client,
    assert,
  }) => {
    const { org, owner, employee, path } = await populated(client)
    const live = await populated(client, 'Vivante')
    const slug = org.slug
    await deletedSince(org, 31)
    assert.isAbove(await rowsOf('leave_requests', org.id), 0)
    assert.isAbove(await rowsOf('leave_balance_ledger', org.id), 0)

    assert.equal(await organizationPurgeService.run(), 1)

    for (const table of PURGED_TABLES) assert.equal(await rowsOf(table, org.id), 0, table)
    assert.equal(await rowsOf('payments', org.id), 1)
    assert.equal(await rowsOf('invoices', org.id), 1)
    assert.equal(await rowsOf('subscriptions', org.id), 1)
    assert.isTrue(await drive.use('s3').exists(`invoices/${org.id}/invoice.pdf`))
    assert.isFalse(await drive.use('s3').exists(path))
    assert.isFalse(await drive.use('s3Public').exists(`${org.id}/organization/${org.id}/logo.png`))

    await org.refresh()
    assert.equal(org.name, PURGED_NAME)
    assert.equal(org.slug, `deleted-${org.id}`)
    assert.isNull(org.logoUrl)
    assert.isNotNull(org.purgedAt)
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'organization.purged')
      .firstOrFail()
    assert.equal(audit.actorRole, 'system')
    assert.deepEqual(audit.beforeData, { name: 'Doztra', slug })

    // Accounts stay, only their roles in this organization went.
    for (const member of [owner, employee]) {
      const user = await User.findOrFail(member.user.id)
      assert.isTrue(user.isActive)
    }
    // The live organization is untouched.
    assert.isAbove(await rowsOf('employees', live.org.id), 0)
    assert.isTrue(await drive.use('s3').exists(live.path))

    assert.equal(await organizationPurgeService.run(), 0)
  })

  test('an organization deleted less than 30 days ago is not purged', async ({
    client,
    assert,
  }) => {
    const { org, path } = await populated(client)
    await deletedSince(org, 29)

    assert.equal(await organizationPurgeService.run(), 0)
    assert.isAbove(await rowsOf('employees', org.id), 0)
    assert.isTrue(await drive.use('s3').exists(path))
    await org.refresh()
    assert.isNull(org.purgedAt)
  })
})

async function platformSession(client: ApiClient, level?: 'root' | 'support') {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  if (level) await PlatformAdmin.create({ userId: user.id, level, isActive: true })
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

const platformCall = (
  client: ApiClient,
  method: string,
  path: string,
  who: { accessToken: string }
) => client.request(`/api/v1/platform${path}`, method).bearerToken(who.accessToken)

test.group('POST /platform/organizations/:id/restore', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('root restores a deleted organization within 30 days, audited', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const root = await platformSession(client, 'root')
    await deletedSince(org, 10)
    await expectStatus(orgCall(client, 'GET', '', owner, org), 403)

    const listed = await expectStatus(
      platformCall(client, 'GET', '/organizations?filter[deleted]=true', root),
      200
    )
    const row = listed.body().data.find((item: { id: string }) => item.id === org.id)
    assert.isNotNull(row.deletedAt)
    const live = await expectStatus(platformCall(client, 'GET', '/organizations', root), 200)
    assert.notInclude(
      live.body().data.map((item: { id: string }) => item.id),
      org.id
    )

    const restored = await expectStatus(
      platformCall(client, 'POST', `/organizations/${org.id}/restore`, root),
      200
    )
    assert.isNull(restored.body().data.deletedAt)
    assert.isNull(restored.body().data.purgedAt)
    await expectStatus(orgCall(client, 'GET', '', owner, org), 200)
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'platform.organization_restored')
      .firstOrFail()
    assert.equal(audit.actorUserId, root.user.id)
    assert.equal(audit.actorRole, 'platform_root')
  })

  test('refuses support, a live, an overdue or a purged organization', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const restore = (who: { accessToken: string }, id = org.id) =>
      platformCall(client, 'POST', `/organizations/${id}/restore`, who)

    const live = await expectStatus(restore(root), 409)
    assert.equal(errorOf(live).details[0].rule, 'notDeleted')

    await deletedSince(org, 5)
    await expectStatus(restore(support), 403)

    await deletedSince(org, 31)
    const overdue = await expectStatus(restore(root), 409)
    assert.equal(errorOf(overdue).details[0].rule, 'purged')

    org.merge({ deletedAt: DateTime.now().minus({ days: 3 }), purgedAt: DateTime.now() })
    await org.save()
    const purged = await expectStatus(restore(root), 409)
    assert.equal(errorOf(purged).details[0].rule, 'purged')

    await expectStatus(restore(root, newId()), 404)
  })
})
