import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import {
  STRONG_PASSWORD,
  apiLogin,
  createOrganization,
  createUser,
  grantRoles,
  makePlatformAdmin,
} from '#tests/helpers/auth'
import { expectStatus, untyped } from '#tests/helpers/http'

const NEW_PASSWORD = 'Nouveau-Mot-2026'

interface SessionItem {
  id: string
  current: boolean
}

test.group('GET /api/v1/me', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('returns the profile, memberships with roles and platform status', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ email: 'me@doztra.test' })
    const org = await createOrganization('Doztra')
    await grantRoles(user, org, ['manager', 'recruiter'])
    await makePlatformAdmin(user)
    const { accessToken } = await apiLogin(client, user.email)

    const response = await expectStatus(client.get('/api/v1/me').bearerToken(accessToken), 200)
    const data = response.body().data
    assert.deepEqual(data.user, {
      id: user.id,
      email: 'me@doztra.test',
      fullName: 'Mariama Camara',
      avatarUrl: null,
      emailVerified: false,
      preferredLanguage: 'fr',
      mustChangePassword: false,
    })
    assert.isTrue(data.isPlatformAdmin)
    assert.equal(data.platformLevel, 'support')
    assert.deepEqual(data.organizations, [
      {
        id: org.id,
        name: 'Doztra',
        slug: org.slug,
        logoUrl: null,
        defaultLanguage: 'fr',
        defaultCurrency: 'GNF',
        plan: null,
        performanceModel: 'sap',
        roles: ['manager', 'recruiter'],
      },
    ])
    assert.isNull(data.employee)
    assert.isNull(data.subscription)
    assert.deepEqual(data.modules, [])
  })

  test('never lists organizations the user does not belong to', async ({ client, assert }) => {
    const mine = await createOrganization('Mine')
    const other = await createOrganization('Other')
    const user = await createUser()
    const stranger = await createUser()
    await grantRoles(user, mine, ['employee'])
    await grantRoles(stranger, other, ['owner'])
    const { accessToken } = await apiLogin(client, user.email)

    const response = await expectStatus(
      client.get('/api/v1/me/organizations').bearerToken(accessToken),
      200
    )
    const ids = (response.body().data as Array<{ id: string }>).map((o) => o.id)
    assert.deepEqual(ids, [mine.id])
  })

  test('exposes the active platform level, null otherwise', async ({ client, assert }) => {
    const me = async (email: string) => {
      const { accessToken } = await apiLogin(client, email)
      const response = await expectStatus(client.get('/api/v1/me').bearerToken(accessToken), 200)
      const { isPlatformAdmin, platformLevel } = response.body().data
      return { isPlatformAdmin, platformLevel }
    }
    const root = await createUser({ email: 'root@doztra.test' })
    const admin = await makePlatformAdmin(root)
    admin.level = 'root'
    await admin.save()
    assert.deepEqual(await me(root.email), { isPlatformAdmin: true, platformLevel: 'root' })

    admin.isActive = false
    await admin.save()
    assert.deepEqual(await me(root.email), { isPlatformAdmin: false, platformLevel: null })

    const plain = await createUser({ email: 'plain@doztra.test' })
    assert.deepEqual(await me(plain.email), { isPlatformAdmin: false, platformLevel: null })
  })

  test('requires authentication', async ({ client }) => {
    await expectStatus(client.get('/api/v1/me'), 401)
    await expectStatus(client.get('/api/v1/me').bearerToken('oat_bogus.token'), 401)
  })

  test('a deactivated account is refused immediately', async ({ client }) => {
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)
    user.isActive = false
    await user.save()
    await expectStatus(client.get('/api/v1/me').bearerToken(accessToken), 401)
  })
})

test.group('PATCH /api/v1/me and POST /api/v1/me/password', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('updates the editable profile fields', async ({ client, assert }) => {
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)
    const response = await expectStatus(
      client
        .patch('/api/v1/me')
        .bearerToken(accessToken)
        .json({ fullName: 'Ibrahima Bayo', preferredLanguage: 'en' }),
      200
    )
    assert.equal(response.body().data.user.fullName, 'Ibrahima Bayo')
    assert.equal(response.body().data.user.preferredLanguage, 'en')
  })

  test('validates profile changes', async ({ client }) => {
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)
    const response = await expectStatus(
      client
        .patch('/api/v1/me')
        .bearerToken(accessToken)
        .json({ preferredLanguage: 'wo', avatarUrl: 'http://insecure.test/a.png' }),
      422
    )
    response.assertBodyContains({ error: { code: 'E_VALIDATION' } })
  })

  test('changing the password requires the current one', async ({ client, assert }) => {
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)
    const response = await expectStatus(
      client
        .post('/api/v1/me/password')
        .bearerToken(accessToken)
        .json(
          untyped({
            currentPassword: 'Wrong-Current-1',
            password: NEW_PASSWORD,
            password_confirmation: NEW_PASSWORD,
          })
        ),
      422
    )
    assert.equal(response.body().error.details[0].field, 'currentPassword')
  })

  test('changing the password revokes the other sessions only', async ({ client, assert }) => {
    const user = await createUser()
    const current = await apiLogin(client, user.email)
    const other = await apiLogin(client, user.email)

    await expectStatus(
      client
        .post('/api/v1/me/password')
        .bearerToken(current.accessToken)
        .json(
          untyped({
            currentPassword: STRONG_PASSWORD,
            password: NEW_PASSWORD,
            password_confirmation: NEW_PASSWORD,
          })
        ),
      204
    )

    await user.refresh()
    const passwordMatches = await hash.verify(user.passwordHash!, NEW_PASSWORD)
    assert.isTrue(passwordMatches)
    await expectStatus(client.get('/api/v1/me').bearerToken(current.accessToken), 200)
    await expectStatus(client.get('/api/v1/me').bearerToken(other.accessToken), 401)
  })
})

test.group('GET and DELETE /api/v1/me/sessions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists open sessions and flags the current one', async ({ client, assert }) => {
    const user = await createUser()
    const current = await apiLogin(client, user.email)
    await apiLogin(client, user.email)

    const response = await expectStatus(
      client.get('/api/v1/me/sessions').bearerToken(current.accessToken),
      200
    )
    const sessions = response.body().data as SessionItem[]
    assert.lengthOf(sessions, 2)
    assert.lengthOf(
      sessions.filter((s) => s.current),
      1
    )
    assert.notProperty(sessions[0], 'tokenHash')
  })

  test('revokes one of its own sessions', async ({ client }) => {
    const user = await createUser()
    const current = await apiLogin(client, user.email)
    const other = await apiLogin(client, user.email)
    const list = await expectStatus(
      client.get('/api/v1/me/sessions').bearerToken(current.accessToken),
      200
    )
    const target = (list.body().data as SessionItem[]).find((s) => !s.current)!

    await expectStatus(
      client.delete(`/api/v1/me/sessions/${target.id}`).bearerToken(current.accessToken),
      204
    )
    await expectStatus(client.get('/api/v1/me').bearerToken(other.accessToken), 401)
  })

  test("another user's session answers 404, never 403", async ({ client }) => {
    const owner = await createUser()
    const intruder = await createUser()
    const victim = await apiLogin(client, owner.email)
    const attacker = await apiLogin(client, intruder.email)
    const list = await expectStatus(
      client.get('/api/v1/me/sessions').bearerToken(victim.accessToken),
      200
    )
    const victimSession = (list.body().data as SessionItem[])[0]

    await expectStatus(
      client.delete(`/api/v1/me/sessions/${victimSession.id}`).bearerToken(attacker.accessToken),
      404
    )
    await expectStatus(client.get('/api/v1/me').bearerToken(victim.accessToken), 200)
  })

  test('validates the session id', async ({ client }) => {
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)
    await expectStatus(
      client.delete('/api/v1/me/sessions/not-a-uuid').bearerToken(accessToken),
      422
    )
  })
})
