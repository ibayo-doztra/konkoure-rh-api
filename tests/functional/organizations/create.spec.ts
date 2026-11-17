import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Organization from '#models/organization'
import UserRole from '#models/user_role'
import { apiLogin, createOrganization, createUser } from '#tests/helpers/auth'
import { errorOf, expectStatus, untyped } from '#tests/helpers/http'

async function verifiedSession(client: Parameters<typeof apiLogin>[0]) {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

test.group('POST /api/v1/organizations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creates the organization, makes the creator owner and audits both', async ({
    client,
    assert,
  }) => {
    const { user, accessToken } = await verifiedSession(client)

    const response = await expectStatus(
      client
        .post('/api/v1/organizations')
        .bearerToken(accessToken)
        .json({ name: 'Société Minière de Boké', defaultLanguage: 'en' }),
      201
    )
    const data = response.body().data
    assert.match(data.slug, /^societe-miniere-de-boke(-\d+)?$/)
    assert.deepInclude(data, {
      name: 'Société Minière de Boké',
      logoUrl: null,
      defaultLanguage: 'en',
      defaultCurrency: 'GNF',
      plan: null,
      performanceModel: 'sap',
      roles: ['owner'],
    })

    const organization = await Organization.findOrFail(data.id)
    assert.equal(organization.timezone, 'Africa/Conakry')
    assert.equal(organization.countryCode, 'GN')
    assert.equal(organization.createdBy, user.id)

    const roles = await UserRole.query().where('organization_id', data.id)
    assert.deepEqual(
      roles.map((role) => [role.userId, role.role, role.grantedBy]),
      [[user.id, 'owner', user.id]]
    )

    const actions = await AuditLog.query()
      .where('organization_id', data.id)
      .orderBy('action')
      .select('action', 'actor_user_id')
    assert.deepEqual(
      actions.map((row) => [row.action, row.actorUserId]),
      [
        ['organization.created', user.id],
        ['role.granted', user.id],
      ]
    )

    const me = await expectStatus(client.get('/api/v1/me').bearerToken(accessToken), 200)
    assert.deepEqual(
      me
        .body()
        .data.organizations.map((org: { id: string; roles: string[] }) => [org.id, org.roles]),
      [[data.id, ['owner']]]
    )
  })

  test('generates the slug server-side and ignores a client slug', async ({ client, assert }) => {
    const { accessToken } = await verifiedSession(client)

    const response = await expectStatus(
      client
        .post('/api/v1/organizations')
        .bearerToken(accessToken)
        .json(untyped({ name: 'Kaloum Tech', slug: 'root', performanceModel: 'classic' })),
      201
    )
    assert.match(response.body().data.slug, /^kaloum-tech(-\d+)?$/)
    assert.equal(response.body().data.performanceModel, 'classic')
  })

  test('suffixes the slug when it is already taken', async ({ client, assert }) => {
    const { accessToken } = await verifiedSession(client)
    await Organization.create({ name: 'Taken', slug: 'nimba-conseil' })
    await Organization.create({ name: 'Taken', slug: 'nimba-conseil-2' })

    const response = await expectStatus(
      client.post('/api/v1/organizations').bearerToken(accessToken).json({ name: 'Nimba Conseil' }),
      201
    )
    assert.equal(response.body().data.slug, 'nimba-conseil-3')
  })

  test('refuses an account whose e-mail is not verified', async ({ client, assert }) => {
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)

    const response = await expectStatus(
      client.post('/api/v1/organizations').bearerToken(accessToken).json({ name: 'Doztra' }),
      403
    )
    assert.equal(errorOf(response).code, 'E_EMAIL_NOT_VERIFIED')
    assert.lengthOf(await UserRole.query().where('user_id', user.id), 0)
  })

  test('requires authentication', async ({ client, assert }) => {
    const response = await expectStatus(
      client.post('/api/v1/organizations').json({ name: 'Doztra' }),
      401
    )
    assert.equal(errorOf(response).code, 'E_UNAUTHORIZED')
  })

  test('validates the input', async ({ client, assert }) => {
    const { accessToken } = await verifiedSession(client)

    const response = await expectStatus(
      client
        .post('/api/v1/organizations')
        .bearerToken(accessToken)
        .json(untyped({ name: 'D', defaultLanguage: 'wo', performanceModel: 'okr' })),
      422
    )
    assert.sameMembers(
      errorOf(response).details.map((detail) => detail.field),
      ['name', 'defaultLanguage', 'performanceModel']
    )
  })

  test('grants no role in organizations the user did not create', async ({ client, assert }) => {
    const { user, accessToken } = await verifiedSession(client)
    const other = await createOrganization('Autre')

    await expectStatus(
      client.post('/api/v1/organizations').bearerToken(accessToken).json({ name: 'Mienne' }),
      201
    )
    assert.lengthOf(
      await UserRole.query().where('user_id', user.id).where('organization_id', other.id),
      0
    )
  })
})
