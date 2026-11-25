import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import PlatformAdmin from '#models/platform_admin'
import User from '#models/user'
import UserRole from '#models/user_role'
import { apiLogin, createUser, STRONG_PASSWORD } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'

async function platformSession(client: ApiClient, level?: 'root' | 'support') {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  if (level) await PlatformAdmin.create({ userId: user.id, level })
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

const call = (client: ApiClient, method: string, path: string, who: { accessToken: string }) =>
  client.request(`/api/v1/platform${path}`, method).bearerToken(who.accessToken)

test.group('Platform users', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('support searches accounts with their organizations and roles', async ({
    client,
    assert,
  }) => {
    const support = await platformSession(client, 'support')
    const org = await createHrOrganization('Boké Mines')
    const member = await hrSession(client, org, ['hr_admin', 'manager'])

    const response = await expectStatus(
      call(client, 'GET', `/users?q=${encodeURIComponent(member.user.email)}`, support),
      200
    )
    assert.lengthOf(response.body().data, 1)
    const row = response.body().data[0]
    assert.deepInclude(row, { id: member.user.id, isActive: true, platformLevel: null })
    assert.deepEqual(row.organizations, [
      { organizationId: org.id, organizationName: 'Boké Mines', roles: ['hr_admin', 'manager'] },
    ])
    assert.notProperty(row, 'passwordHash')
  })

  test('root replaces roles in an organization; the last owner is kept', async ({
    client,
    assert,
  }) => {
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const member = await hrSession(client, org, ['employee'])
    const patch = (who: { accessToken: string }, userId: string, roles: string[]) =>
      call(client, 'PATCH', `/users/${userId}/roles`, who).json({ organizationId: org.id, roles })

    await expectStatus(patch(support, member.user.id, ['manager']), 403)
    const updated = await expectStatus(patch(root, member.user.id, ['manager', 'owner']), 200)
    assert.equal(updated.body().data.organizationId, org.id)
    assert.sameMembers(updated.body().data.roles, ['manager', 'owner'])

    // The first owner may now go: another owner remains.
    await expectStatus(patch(root, owner.user.id, []), 200)
    const last = await expectStatus(patch(root, member.user.id, ['manager']), 409)
    assert.equal(errorOf(last).details[0].rule, 'lastOwner')

    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'role.granted')
      .where('actor_user_id', root.user.id)
      .firstOrFail()
    assert.equal(audit.actorRole, 'platform_root')
    assert.isNull(
      await UserRole.query()
        .where('user_id', owner.user.id)
        .where('organization_id', org.id)
        .first()
    )
  })

  test('a ban ends every session at once; unban restores the account', async ({
    client,
    assert,
  }) => {
    const root = await platformSession(client, 'root')
    const org = await createHrOrganization()
    const member = await hrSession(client, org, ['owner'])
    await expectStatus(orgCall(client, 'GET', '/', member, org), 200)

    const banned = await expectStatus(
      call(client, 'POST', `/users/${member.user.id}/ban`, root).json({
        reason: 'Fraude au paiement',
      }),
      200
    )
    assert.isFalse(banned.body().data.isActive)
    await expectStatus(orgCall(client, 'GET', '/', member, org), 401)
    const { rows } = await db.rawQuery(
      'select count(*)::int as total from auth_access_tokens where tokenable_id = ?',
      [member.user.id]
    )
    assert.equal(rows[0].total, 0)
    await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: member.user.email, password: STRONG_PASSWORD }),
      401
    )
    await expectStatus(
      call(client, 'POST', `/users/${member.user.id}/ban`, root).json({ reason: 'Encore' }),
      409
    )

    await expectStatus(call(client, 'POST', `/users/${member.user.id}/unban`, root), 200)
    const user = await User.findOrFail(member.user.id)
    assert.isTrue(user.isActive)
    assert.lengthOf(
      await AuditLog.query()
        .where('target_id', member.user.id)
        .whereIn('action', ['user.banned', 'user.unbanned']),
      2
    )
  })

  test('a ban is refused on oneself, on a platform admin and without reason', async ({
    client,
    assert,
  }) => {
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const target = await createUser()
    const ban = (userId: string, body: Record<string, unknown> = { reason: 'Abus' }) =>
      call(client, 'POST', `/users/${userId}/ban`, root).json(body)

    assert.equal(errorOf(await expectStatus(ban(root.user.id), 409)).details[0].rule, 'self')
    assert.equal(
      errorOf(await expectStatus(ban(support.user.id), 409)).details[0].rule,
      'platformAdmin'
    )
    await expectStatus(ban(target.id, {}), 422)
    await expectStatus(
      call(client, 'POST', `/users/${target.id}/ban`, support).json({ reason: 'Abus' }),
      403
    )
  })

  test('impersonation gives a 30-minute token with guarded actions', async ({ client, assert }) => {
    const root = await platformSession(client, 'root')
    const org = await createHrOrganization()
    const member = await hrSession(client, org, ['owner'])

    const started = await expectStatus(
      call(client, 'POST', `/users/${member.user.id}/impersonate`, root).json({
        reason: 'Ticket support 42',
      }),
      201
    )
    const { accessToken, expiresIn } = started.body().data
    assert.equal(expiresIn, 1800)
    const as = { accessToken }

    const me = await expectStatus(client.get('/api/v1/me').bearerToken(accessToken), 200)
    assert.equal(me.body().data.user.id, member.user.id)
    assert.equal(me.body().data.impersonation.by, root.user.id)
    assert.isString(me.body().data.impersonation.expiresAt)
    await expectStatus(orgCall(client, 'GET', '/', as, org), 200)

    // Forbidden while impersonating.
    await expectStatus(
      client
        .post('/api/v1/me/password')
        .bearerToken(accessToken)
        .json({ currentPassword: STRONG_PASSWORD, password: 'Autre-Mot-2026' }),
      403
    )
    await expectStatus(client.patch('/api/v1/me').bearerToken(accessToken).json({}), 403)
    await expectStatus(client.post('/api/v1/auth/logout-all').bearerToken(accessToken), 403)
    await expectStatus(orgCall(client, 'DELETE', '/', as, org).json({ confirmName: 'x' }), 403)
    await expectStatus(orgCall(client, 'POST', '/billing/cancel', as, org), 403)
    await expectStatus(call(client, 'GET', '/dashboard', as), 403)

    const plain = await expectStatus(client.get('/api/v1/me').bearerToken(member.accessToken), 200)
    assert.isNull(plain.body().data.impersonation)

    const audit = await AuditLog.query()
      .where('target_id', member.user.id)
      .where('action', 'impersonation.started')
      .firstOrFail()
    assert.equal(audit.actorUserId, root.user.id)
    assert.equal(audit.afterData?.reason, 'Ticket support 42')

    // Expired after 30 minutes.
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', member.user.id)
      .where('name', `impersonation:${root.user.id}`)
      .update({ expires_at: DateTime.now().minus({ minutes: 1 }).toJSDate() })
    await expectStatus(client.get('/api/v1/me').bearerToken(accessToken), 401)
  })

  test('impersonation is refused on a platform admin, a banned account and by support', async ({
    client,
    assert,
  }) => {
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const banned = await createUser({ isActive: false })
    const target = await createUser()
    const start = (who: { accessToken: string }, userId: string) =>
      call(client, 'POST', `/users/${userId}/impersonate`, who).json({ reason: 'Vérification' })

    assert.equal(
      errorOf(await expectStatus(start(root, support.user.id), 409)).details[0].rule,
      'platformAdmin'
    )
    assert.equal(errorOf(await expectStatus(start(root, banned.id), 409)).details[0].rule, 'banned')
    await expectStatus(start(support, target.id), 403)
  })
})

test.group('Platform admins', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('root grants, changes and removes admins; the last root stays', async ({
    client,
    assert,
  }) => {
    await PlatformAdmin.query().update({ isActive: false })
    const root = await platformSession(client, 'root')
    const support = await platformSession(client, 'support')
    const candidate = await createUser()

    await expectStatus(call(client, 'GET', '/admins', support), 403)
    const granted = await expectStatus(
      call(client, 'POST', '/admins', root).json({ email: candidate.email, level: 'support' }),
      201
    )
    assert.deepInclude(granted.body().data, { userId: candidate.id, level: 'support' })
    await expectStatus(
      call(client, 'POST', '/admins', root).json({ email: 'inconnu@exemple.gn', level: 'root' }),
      422
    )

    const listed = await expectStatus(call(client, 'GET', '/admins', root), 200)
    assert.sameMembers(
      listed.body().data.map((row: { userId: string }) => row.userId),
      [root.user.id, support.user.id, candidate.id]
    )

    // The only root can neither leave nor be downgraded.
    const last = await expectStatus(call(client, 'DELETE', `/admins/${root.user.id}`, root), 409)
    assert.equal(errorOf(last).details[0].rule, 'lastRoot')
    await expectStatus(
      call(client, 'POST', '/admins', root).json({ email: root.user.email, level: 'support' }),
      409
    )

    await expectStatus(call(client, 'DELETE', `/admins/${candidate.id}`, root), 204)
    const removed = await PlatformAdmin.findByOrFail('user_id', candidate.id)
    assert.isFalse(removed.isActive)
    assert.lengthOf(
      await AuditLog.query()
        .where('target_id', candidate.id)
        .whereIn('action', ['platform_admin.granted', 'platform_admin.revoked']),
      2
    )
  })
})
