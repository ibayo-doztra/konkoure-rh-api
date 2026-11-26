import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AuditLog from '#models/audit_log'
import Employee from '#models/employee'
import Notification from '#models/notification'
import PlatformAdmin from '#models/platform_admin'
import User from '#models/user'
import UserRole from '#models/user_role'
import accountDeletionService from '#modules/users/services/account_deletion_service'
import { STRONG_PASSWORD, apiLogin, createUser, grantRoles } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createHrOrganization, hrSession } from '#tests/helpers/hr'

function notify(organizationId: string, userId: string) {
  return Notification.create({
    organizationId,
    userId,
    type: 'leave.requested',
    title: 'Titre',
    body: null,
    link: '/leaves',
    payload: {},
  })
}

test.group('DELETE /api/v1/me', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('requires the right password', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const member = await hrSession(client, org, ['employee'])
    const call = (body: Record<string, unknown>) =>
      client.delete('/api/v1/me').bearerToken(member.accessToken).json(body)

    const missing = await expectStatus(call({}), 422)
    assert.equal(errorOf(missing).details[0].field, 'password')
    const wrong = await expectStatus(call({ password: 'pas-le-bon' }), 422)
    assert.deepInclude(errorOf(wrong).details, {
      field: 'password',
      rule: 'invalid',
      message: errorOf(wrong).details[0].message,
    })
    const fresh = await User.findOrFail(member.user.id)
    assert.isTrue(fresh.isActive)
    assert.isNull(fresh.deletedAt)
  })

  test('anonymizes the account and keeps the employee record unlinked', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization('Doztra')
    const other = await createHrOrganization('Autre')
    const member = await hrSession(client, org, ['employee', 'recruiter'])
    await grantRoles(member.user, other, ['employee'])
    const colleague = await hrSession(client, org, ['employee'])
    await notify(org.id, member.user.id)
    const kept = await notify(org.id, colleague.user.id)

    await expectStatus(
      client
        .delete('/api/v1/me')
        .bearerToken(member.accessToken)
        .json({ password: STRONG_PASSWORD }),
      204
    )

    const user = await User.findOrFail(member.user.id)
    assert.equal(user.email, `deleted+${user.id}@invalid`)
    assert.isNull(user.fullName)
    assert.isNull(user.avatarUrl)
    assert.isNull(user.passwordHash)
    assert.isFalse(user.isActive)
    assert.isNotNull(user.deletedAt)
    assert.lengthOf(await UserRole.query().where('user_id', user.id), 0)

    const employee = await Employee.findOrFail(member.employee!.id)
    assert.isNull(employee.userId)
    assert.isNull(employee.deletedAt)
    assert.lengthOf(await Notification.query().where('user_id', user.id), 0)
    assert.isNotNull(await Notification.find(kept.id))
    const colleagueEmployee = await Employee.findOrFail(colleague.employee!.id)
    assert.equal(colleagueEmployee.userId, colleague.user.id)

    const audit = await AuditLog.query()
      .where('action', 'user.deleted')
      .where('target_id', user.id)
      .firstOrFail()
    assert.isNull(audit.actorEmail)
    assert.isNull(audit.organizationId)
    assert.notInclude(JSON.stringify(audit.afterData), member.user.email)

    // Every session has ended and the old e-mail no longer signs in.
    await expectStatus(client.get('/api/v1/me').bearerToken(member.accessToken), 401)
    await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: member.user.email, password: STRONG_PASSWORD }),
      401
    )
  })

  test('refuses the only owner of an organization, not one of two', async ({ client, assert }) => {
    const org = await createHrOrganization('Doztra')
    const owner = await hrSession(client, org, ['owner'])
    const call = () =>
      client.delete('/api/v1/me').bearerToken(owner.accessToken).json({ password: STRONG_PASSWORD })

    const refused = await expectStatus(call(), 409)
    assert.deepEqual(
      errorOf(refused).details.map((detail) => [detail.field, detail.rule]),
      [[`organizations.${org.id}`, 'lastOwner']]
    )
    const stillThere = await User.findOrFail(owner.user.id)
    assert.isTrue(stillThere.isActive)

    // An inactive second owner does not count; an active one does.
    const second = await createUser({ isActive: false })
    await grantRoles(second, org, ['owner'])
    await expectStatus(call(), 409)
    second.isActive = true
    await second.save()
    await expectStatus(call(), 204)
  })

  test('a deleted organization does not block its owner', async ({ client }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    await org.merge({ deletedAt: DateTime.now() }).save()
    await expectStatus(
      client
        .delete('/api/v1/me')
        .bearerToken(owner.accessToken)
        .json({ password: STRONG_PASSWORD }),
      204
    )
  })

  test('keeps the last active root and closes another admin record', async ({ client, assert }) => {
    const root = await createUser()
    await PlatformAdmin.create({ userId: root.id, level: 'root', isActive: true })
    const rootLogin = await apiLogin(client, root.email)
    const refused = await expectStatus(
      client
        .delete('/api/v1/me')
        .bearerToken(rootLogin.accessToken)
        .json({ password: STRONG_PASSWORD }),
      409
    )
    assert.equal(errorOf(refused).details[0].rule, 'lastRoot')

    const support = await createUser()
    const admin = await PlatformAdmin.create({
      userId: support.id,
      level: 'support',
      isActive: true,
    })
    const supportLogin = await apiLogin(client, support.email)
    await expectStatus(
      client
        .delete('/api/v1/me')
        .bearerToken(supportLogin.accessToken)
        .json({ password: STRONG_PASSWORD }),
      204
    )
    await admin.refresh()
    assert.isFalse(admin.isActive)
  })

  test('the tenant rows are detached under the application role (RLS)', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const member = await hrSession(client, org, ['employee'])
    await notify(org.id, member.user.id)
    const user = await User.findOrFail(member.user.id)
    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    await accountDeletionService.delete(user, STRONG_PASSWORD, {})
    await db.rawQuery('RESET ROLE')
    const record = await Employee.findOrFail(member.employee!.id)
    assert.isNull(record.userId)
    assert.lengthOf(await Notification.query().where('user_id', user.id), 0)
  })

  test('requires authentication', async ({ client }) => {
    await expectStatus(client.delete('/api/v1/me').json({ password: STRONG_PASSWORD }), 401)
  })
})
