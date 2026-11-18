import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import type Organization from '#models/organization'
import type User from '#models/user'
import UserRole, { type AppRole } from '#models/user_role'
import { apiLogin, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'

async function member(organization: Organization, roles: AppRole[]) {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  await grantRoles(user, organization, roles)
  return user
}

async function session(client: ApiClient, organization: Organization, roles: AppRole[]) {
  const user = await member(organization, roles)
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

function call(
  client: ApiClient,
  method: string,
  path: string,
  who: { accessToken: string },
  organization: Organization
) {
  // Dynamic method and URL: the request is deliberately outside the typed routes.
  return client
    .request(`/api/v1/org/members${path}`, method)
    .bearerToken(who.accessToken)
    .header('X-Organization-Id', organization.id)
}

async function rolesOf(user: User, organization: Organization) {
  const rows = await UserRole.query()
    .where('user_id', user.id)
    .where('organization_id', organization.id)
    .orderBy('role')
  return rows.map((row) => row.role)
}

test.group('GET /org/members', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists this organization only, one entry per user', async ({ client, assert }) => {
    const org = await createOrganization('Mienne')
    const other = await createOrganization('Autre')
    const owner = await session(client, org, ['owner'])
    const several = await member(org, ['manager', 'recruiter'])
    const outsider = await member(other, ['owner'])

    const response = await expectStatus(call(client, 'GET', '?perPage=1', owner, org), 200)
    assert.equal(response.body().meta.total, 2)
    assert.lengthOf(response.body().data, 1)

    const all = await expectStatus(call(client, 'GET', '', owner, org), 200)
    const entries = all.body().data as Array<{ userId: string; roles: string[] }>
    assert.sameMembers(
      entries.map((entry) => entry.userId),
      [owner.user.id, several.id]
    )
    assert.notInclude(JSON.stringify(all.body()), outsider.email)
    assert.notInclude(JSON.stringify(all.body()), 'passwordHash')
    assert.sameMembers(entries.find((entry) => entry.userId === several.id)!.roles, [
      'manager',
      'recruiter',
    ])
  })

  test('is refused to other roles and validates pagination', async ({ client }) => {
    const org = await createOrganization()
    const manager = await session(client, org, ['manager'])
    const owner = await session(client, org, ['owner'])
    await expectStatus(call(client, 'GET', '', manager, org), 403)
    await expectStatus(call(client, 'GET', '?perPage=500', owner, org), 422)
  })
})

test.group('PATCH /org/members/:userId/roles', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('replaces the roles and audits each change', async ({ client, assert }) => {
    const org = await createOrganization()
    const admin = await session(client, org, ['hr_admin'])
    const target = await member(org, ['employee', 'recruiter'])

    const response = await expectStatus(
      call(client, 'PATCH', `/${target.id}/roles`, admin, org).json({
        roles: ['manager', 'recruiter'],
      }),
      200
    )
    assert.sameMembers(response.body().data.roles, ['manager', 'recruiter'])
    assert.sameMembers(await rolesOf(target, org), ['manager', 'recruiter'])

    const logs = await AuditLog.query()
      .where('organization_id', org.id)
      .where('target_id', target.id)
    assert.sameMembers(
      logs.map((log) => log.action),
      ['role.granted', 'role.revoked']
    )
  })

  test('a member of another organization is 404', async ({ client, assert }) => {
    const org = await createOrganization('Mienne')
    const other = await createOrganization('Autre')
    const owner = await session(client, org, ['owner'])
    const outsider = await member(other, ['employee'])

    const response = await expectStatus(
      call(client, 'PATCH', `/${outsider.id}/roles`, owner, org).json({ roles: ['manager'] }),
      404
    )
    assert.equal(errorOf(response).code, 'E_NOT_FOUND')
    assert.deepEqual(await rolesOf(outsider, other), ['employee'])
  })

  test('hr_admin cannot grant owner nor change an owner', async ({ client, assert }) => {
    const org = await createOrganization()
    const admin = await session(client, org, ['hr_admin'])
    const target = await member(org, ['employee'])
    const anOwner = await member(org, ['owner'])

    await expectStatus(
      call(client, 'PATCH', `/${target.id}/roles`, admin, org).json({ roles: ['owner'] }),
      403
    )
    await expectStatus(
      call(client, 'PATCH', `/${anOwner.id}/roles`, admin, org).json({ roles: ['employee'] }),
      403
    )
    assert.deepEqual(await rolesOf(anOwner, org), ['owner'])
  })

  test('an owner can grant owner but not change their own roles', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    const target = await member(org, ['employee'])

    await expectStatus(
      call(client, 'PATCH', `/${target.id}/roles`, owner, org).json({ roles: ['owner'] }),
      200
    )
    assert.deepEqual(await rolesOf(target, org), ['owner'])
    await expectStatus(
      call(client, 'PATCH', `/${owner.user.id}/roles`, owner, org).json({ roles: ['employee'] }),
      403
    )
  })

  test('another role is refused and the list is validated', async ({ client }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    const manager = await session(client, org, ['manager'])
    const target = await member(org, ['employee'])
    const path = `/${target.id}/roles`

    await expectStatus(call(client, 'PATCH', path, manager, org).json({ roles: ['manager'] }), 403)
    await expectStatus(call(client, 'PATCH', path, owner, org).json({ roles: [] }), 422)
    await expectStatus(call(client, 'PATCH', path, owner, org).json({ roles: ['boss'] }), 422)
    await expectStatus(
      call(client, 'PATCH', path, owner, org).json({ roles: ['manager', 'manager'] }),
      422
    )
    await expectStatus(
      call(client, 'PATCH', '/not-a-uuid/roles', owner, org).json({ roles: ['manager'] }),
      422
    )
  })
})

test.group('DELETE /org/members/:userId', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('removes the access at once', async ({ client, assert }) => {
    const org = await createOrganization()
    const admin = await session(client, org, ['hr_admin'])
    const target = await session(client, org, ['manager', 'employee'])

    await expectStatus(call(client, 'DELETE', `/${target.user.id}`, admin, org), 204)
    assert.lengthOf(await rolesOf(target.user, org), 0)
    await expectStatus(call(client, 'GET', '', target, org), 403)
    assert.lengthOf(
      await AuditLog.query()
        .where('organization_id', org.id)
        .where('action', 'role.revoked')
        .where('target_id', target.user.id),
      2
    )
  })

  test('the last active owner cannot leave', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    const inactive = await member(org, ['owner'])
    inactive.isActive = false
    await inactive.save()

    const response = await expectStatus(
      call(client, 'DELETE', `/${owner.user.id}`, owner, org),
      409
    )
    assert.equal(errorOf(response).details[0].rule, 'lastOwner')
    assert.deepEqual(await rolesOf(owner.user, org), ['owner'])
  })

  test('an owner can leave when another active owner remains', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    await member(org, ['owner'])

    await expectStatus(call(client, 'DELETE', `/${owner.user.id}`, owner, org), 204)
    assert.lengthOf(await rolesOf(owner.user, org), 0)
  })

  test('hr_admin cannot remove an owner; other tenants and roles are refused', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization('Mienne')
    const other = await createOrganization('Autre')
    const admin = await session(client, org, ['hr_admin'])
    const manager = await session(client, org, ['manager'])
    const anOwner = await member(org, ['owner'])
    const outsider = await member(other, ['employee'])

    await expectStatus(call(client, 'DELETE', `/${anOwner.id}`, admin, org), 403)
    await expectStatus(call(client, 'DELETE', `/${anOwner.id}`, manager, org), 403)
    await expectStatus(call(client, 'DELETE', `/${outsider.id}`, admin, org), 404)
    assert.deepEqual(await rolesOf(outsider, other), ['employee'])
  })
})
