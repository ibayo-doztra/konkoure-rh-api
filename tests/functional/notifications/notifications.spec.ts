import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import notificationService from '#modules/notifications/services/notification_service'
import contractExpiryService from '#modules/hr/services/contract_expiry_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { encodeCursor } from '#shared/pagination/cursor'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createContract,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'
import { week } from '#tests/helpers/leaves'

type Session = Awaited<ReturnType<typeof hrSession>>

/** One connection in tests: rows are created one after the other. */
async function seed(
  organization: Organization,
  who: Session,
  count: number,
  type = 'leave.requested'
) {
  const start = DateTime.now().minus({ hours: 1 })
  const rows: Notification[] = []
  for (let index = 0; index < count; index += 1) {
    rows.push(
      await Notification.create({
        organizationId: organization.id,
        userId: who.user.id,
        type,
        title: `Titre ${index}`,
        body: null,
        link: `/x/${index}`,
        payload: { index },
        createdAt: start.plus({ minutes: index }),
      })
    )
  }
  return rows
}

test.group('GET/POST /me/notifications', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  /** `orgCall` prefixes `/org`: notifications live under `/me`. */
  const meCall = (
    client: Parameters<typeof hrSession>[0],
    method: string,
    path: string,
    who: Session,
    org: Organization
  ) =>
    client[method.toLowerCase() as 'get' | 'post'](`/api/v1/me/notifications${path}`)
      .bearerToken(who.accessToken)
      .header('X-Organization-Id', org.id)

  test('pages newest first with a cursor, counts the unread', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const me = await hrSession(client, org, ['employee'])
    await seed(org, me, 3)

    const first = await expectStatus(meCall(client, 'GET', '?limit=2', me, org), 200)
    assert.deepEqual(
      first.body().data.map((row: { title: string }) => row.title),
      ['Titre 2', 'Titre 1']
    )
    assert.equal(first.body().meta.unreadCount, 3)
    assert.isString(first.body().meta.nextCursor)
    assert.containsSubset(first.body().data[0], {
      type: 'leave.requested',
      body: null,
      link: '/x/2',
      payload: { index: 2 },
      readAt: null,
    })

    const second = await expectStatus(
      meCall(client, 'GET', `?limit=2&cursor=${first.body().meta.nextCursor}`, me, org),
      200
    )
    assert.deepEqual(
      second.body().data.map((row: { title: string }) => row.title),
      ['Titre 0']
    )
    assert.isNull(second.body().meta.nextCursor)

    const invalid = await expectStatus(meCall(client, 'GET', '?cursor=abc', me, org), 422)
    assert.equal(errorOf(invalid).details[0].field, 'cursor')
    await expectStatus(meCall(client, 'GET', '?limit=500', me, org), 422)
  })

  test('marks one or all as read; others are invisible', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const me = await hrSession(client, org, ['employee'])
    const colleague = await hrSession(client, org, ['employee'])
    const [first] = await seed(org, me, 3)
    const [theirs] = await seed(org, colleague, 1)
    await Notification.create({
      organizationId: other.id,
      userId: me.user.id,
      type: 'leave.decided',
      title: 'Ailleurs',
      payload: {},
    })

    const read = await expectStatus(meCall(client, 'POST', `/${first.id}/read`, me, org), 200)
    assert.isString(read.body().data.readAt)
    await expectStatus(meCall(client, 'POST', `/${theirs.id}/read`, me, org), 404)

    const unread = await expectStatus(meCall(client, 'GET', '?unreadOnly=true', me, org), 200)
    assert.lengthOf(unread.body().data, 2)
    assert.equal(unread.body().meta.unreadCount, 2)

    const all = await expectStatus(meCall(client, 'POST', '/read-all', me, org), 200)
    assert.equal(all.body().data.updated, 2)
    const after = await expectStatus(meCall(client, 'GET', '', me, org), 200)
    assert.equal(after.body().meta.unreadCount, 0)
    assert.lengthOf(after.body().data, 3)
    // The notification of the other organization stays unread and hidden here.
    const elsewhere = await Notification.query().where('organization_id', other.id).firstOrFail()
    assert.isNull(elsewhere.readAt)
    const theirsAfter = await Notification.findOrFail(theirs.id)
    assert.isNull(theirsAfter.readAt)
  })

  test('the organization header is required', async ({ client }) => {
    const org = await createHrOrganization()
    const me = await hrSession(client, org, ['employee'])
    await expectStatus(client.get('/api/v1/me/notifications').bearerToken(me.accessToken), 400)
  })
})

test.group('Notifications emitted by business events (07 §8)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('a leave request notifies the manager, the decision the requester', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })

    const created = await expectStatus(
      orgCall(client, 'POST', '/leaves', report, org).json({ type: 'annual', ...week() }),
      201
    )
    const leaveId = created.body().data.id
    const [request] = await Notification.query().where('user_id', manager.user.id)
    assert.containsSubset(request.toJSON(), {
      type: 'leave.requested',
      link: `/leaves/${leaveId}`,
      title: 'Nouvelle demande de congé',
    })
    assert.include(request.body!, report.employee!.firstName)
    // Nobody is told of their own action.
    assert.lengthOf(await Notification.query().where('user_id', report.user.id), 0)

    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/approve`, manager, org), 200)
    const [decision] = await Notification.query().where('user_id', report.user.id)
    assert.equal(decision.type, 'leave.decided')
    assert.equal(decision.title, 'Congé approuvé')
    assert.deepEqual(decision.payload, { leaveId, decision: 'approved' })
  })

  test('a badge notifies its holder, in their language', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const holder = await hrSession(client, org, ['employee'])
    holder.user.merge({ preferredLanguage: 'en' })
    await holder.user.save()

    await expectStatus(
      orgCall(client, 'POST', `/employees/${holder.employee!.id}/badge`, hr, org).json({
        badgeUid: '0C9C6B3E',
      }),
      201
    )
    const [notification] = await Notification.query().where('user_id', holder.user.id)
    assert.equal(notification.type, 'badge.assigned')
    assert.equal(notification.title, 'Timeclock badge assigned')
    assert.include(notification.body!, '6B3E')
  })

  test('an expiring contract notifies HR', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const worker = await createEmployee(org)
    await createContract(worker, {
      status: 'active',
      type: 'cdd',
      endDate: DateTime.now().plus({ days: 10 }),
    })

    await contractExpiryService.run()
    const [notification] = await Notification.query().where('user_id', hr.user.id)
    assert.equal(notification.type, 'contract.expiring')
    assert.equal(notification.link, `/employees/${worker.id}`)
  })

  test('identical unread notifications are grouped for 5 minutes', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const me = await hrSession(client, org, ['employee'])
    const message = {
      type: 'badge.assigned' as const,
      key: 'badgeAssigned',
      data: { uid: '••••0001' },
      link: '/timeclock',
    }
    await notificationService.notify(org.id, [me.user], message, null)
    await notificationService.notify(
      org.id,
      [me.user],
      { ...message, data: { uid: '••••0002' } },
      null
    )
    const rows = await Notification.query().where('user_id', me.user.id)
    assert.lengthOf(rows, 1)
    assert.include(rows[0].body!, '0002')

    rows[0].merge({ readAt: DateTime.now() })
    await rows[0].save()
    await notificationService.notify(org.id, [me.user], message, null)
    assert.lengthOf(await Notification.query().where('user_id', me.user.id), 2)
    // The author of the action is never notified.
    await notificationService.notify(org.id, [me.user], { ...message, link: '/y' }, me.user.id)
    assert.lengthOf(await Notification.query().where('user_id', me.user.id), 2)
  })

  test('the purge removes notifications older than 180 days', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const me = await hrSession(client, org, ['employee'])
    const [old, recent] = await seed(org, me, 2)
    old.merge({ createdAt: DateTime.now().minus({ days: 181 }) })
    await old.save()

    await notificationService.purge()
    assert.isNull(await Notification.find(old.id))
    assert.exists(await Notification.find(recent.id))
  })

  test('works under RLS and hides other tenants', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const me = await hrSession(client, org, ['employee'])
    await seed(org, me, 2)
    await seed(other, me, 1)
    const tenant = new TenantContext(org.id, ['employee'])

    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    const page = await notificationService.list(tenant, me.user.id, {})
    assert.lengthOf(page.rows, 2)
    assert.equal(page.unreadCount, 2)
    assert.equal(await notificationService.readAll(tenant, me.user.id), 2)
    await notificationService.notify(
      org.id,
      [me.user],
      { type: 'badge.assigned', key: 'badgeAssigned', data: { uid: 'x' } },
      null
    )
    const after = await notificationService.list(tenant, me.user.id, { unreadOnly: true })
    assert.lengthOf(after.rows, 1)
    assert.isString(encodeCursor(after.rows[0].createdAt, after.rows[0].id))
  })
})
