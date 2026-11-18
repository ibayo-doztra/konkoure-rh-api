import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import drive from '@adonisjs/drive/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import Organization from '#models/organization'
import type { AppRole } from '#models/user_role'
import { apiLogin, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createInvitation } from '#tests/helpers/invitations'

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
])

async function session(client: ApiClient, organization: Organization, roles: AppRole[]) {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  await grantRoles(user, organization, roles)
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
    .request(`/api/v1/org${path}`, method)
    .bearerToken(who.accessToken)
    .header('X-Organization-Id', organization.id)
}

function auditCount(organization: Organization, action: string) {
  return AuditLog.query().where('organization_id', organization.id).where('action', action)
}

test.group('GET and PATCH /org', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('any member reads the organization with default settings', async ({ client, assert }) => {
    const org = await createOrganization()
    const employee = await session(client, org, ['employee'])

    const response = await expectStatus(call(client, 'GET', '', employee, org), 200)
    const data = response.body().data
    assert.equal(data.id, org.id)
    assert.equal(data.timezone, 'Africa/Conakry')
    assert.equal(data.settings.leave.annualEntitlementDays, 30)
    assert.equal(data.settings.branding.primaryColor, '#0F7A5A')
  })

  test('a non-member of the organization is refused', async ({ client, assert }) => {
    const mine = await createOrganization('Mienne')
    const other = await createOrganization('Autre')
    const owner = await session(client, mine, ['owner'])

    const response = await expectStatus(call(client, 'GET', '', owner, other), 403)
    assert.equal(errorOf(response).code, 'E_FORBIDDEN')
    await expectStatus(call(client, 'PATCH', '', owner, other).json({ name: 'Volée' }), 403)
    await other.refresh()
    assert.equal(other.name, 'Autre')
  })

  test('hr_admin updates the organization, slug unchanged, and it is audited', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const admin = await session(client, org, ['hr_admin'])

    const response = await expectStatus(
      call(client, 'PATCH', '', admin, org).json({
        name: 'Nouveau nom',
        defaultLanguage: 'en',
        timezone: 'Africa/Abidjan',
        performanceModel: 'classic',
      }),
      200
    )
    const data = response.body().data
    assert.equal(data.name, 'Nouveau nom')
    assert.equal(data.slug, org.slug)
    assert.equal(data.timezone, 'Africa/Abidjan')

    const log = await auditCount(org, 'organization.updated').firstOrFail()
    assert.equal(log.actorUserId, admin.user.id)
    assert.equal(log.beforeData?.name, 'Doztra')
  })

  test('a manager cannot update the organization', async ({ client }) => {
    const org = await createOrganization()
    const manager = await session(client, org, ['manager'])
    await expectStatus(call(client, 'PATCH', '', manager, org).json({ name: 'Non' }), 403)
  })

  test('rejects another currency and an unknown time zone', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])

    const currency = await expectStatus(
      call(client, 'PATCH', '', owner, org).json({ defaultCurrency: 'EUR' }),
      422
    )
    assert.equal(errorOf(currency).details[0].field, 'defaultCurrency')

    const zone = await expectStatus(
      call(client, 'PATCH', '', owner, org).json({ timezone: 'Mars/Olympus' }),
      422
    )
    assert.equal(errorOf(zone).details[0].rule, 'timezone')
  })
})

test.group('PUT /org/settings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('replaces the block; absent keys return to their default', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])

    await expectStatus(
      call(client, 'PUT', '/settings', owner, org).json({
        leave: { annualEntitlementDays: 26 },
        branding: { primaryColor: '#112233' },
      }),
      200
    )
    const response = await expectStatus(
      call(client, 'PUT', '/settings', owner, org).json({ leave: { maxNegativeDays: 2 } }),
      200
    )
    const { settings } = response.body().data
    assert.equal(settings.leave.maxNegativeDays, 2)
    assert.equal(settings.leave.annualEntitlementDays, 30)
    assert.equal(settings.branding.primaryColor, '#0F7A5A')
    assert.lengthOf(await auditCount(org, 'organization.settings_updated'), 2)
  })

  test('validates bounds and refuses other roles', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    const employee = await session(client, org, ['employee'])

    const invalid = await expectStatus(
      call(client, 'PUT', '/settings', owner, org).json({ branding: { primaryColor: 'red' } }),
      422
    )
    assert.equal(errorOf(invalid).details[0].field, 'branding.primaryColor')
    await expectStatus(call(client, 'PUT', '/settings', employee, org).json({}), 403)
  })
})

test.group('POST /org/logo', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3Public')
    return () => drive.restore('s3Public')
  })

  test('stores the logo and removes the previous one', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    const disk = drive.use('s3Public')
    const upload = async () => {
      const response = await expectStatus(
        call(client, 'POST', '/logo', owner, org).file('logo', PNG, { filename: 'logo.png' }),
        200
      )
      return response.body().data.logoUrl as string
    }

    const first = await upload()
    const second = await upload()
    assert.notEqual(first, second)

    const keyOf = (url: string) => url.slice(url.indexOf(org.id)).split('?')[0]
    assert.match(keyOf(second), new RegExp(`^${org.id}/organization/${org.id}/.+\\.png$`))
    assert.isTrue(await disk.exists(keyOf(second)))
    assert.isFalse(await disk.exists(keyOf(first)))
    assert.lengthOf(await auditCount(org, 'organization.logo_updated'), 2)
  })

  test('judges the real content, not the file name: SVG is refused', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])

    for (const [content, filename] of [
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.svg'],
      [Buffer.from('<script>alert(1)</script>'), 'logo.png'],
    ] as const) {
      const response = await expectStatus(
        call(client, 'POST', '/logo', owner, org).file('logo', content, { filename }),
        422
      )
      assert.equal(errorOf(response).details[0].rule, 'imageType')
    }
    await org.refresh()
    assert.isNull(org.logoUrl)
  })

  test('refuses a file over 2 MB, a missing file and other roles', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await session(client, org, ['owner'])
    const manager = await session(client, org, ['manager'])
    const tooLarge = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])

    const response = await expectStatus(
      call(client, 'POST', '/logo', owner, org).file('logo', tooLarge, { filename: 'logo.png' }),
      413
    )
    assert.equal(errorOf(response).code, 'E_PAYLOAD_TOO_LARGE')
    await expectStatus(call(client, 'POST', '/logo', owner, org), 422)
    await expectStatus(
      call(client, 'POST', '/logo', manager, org).file('logo', PNG, { filename: 'logo.png' }),
      403
    )
  })
})

test.group('DELETE /org', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the owner deletes it with its exact name and access stops', async ({ client, assert }) => {
    const org = await createOrganization('Doztra')
    const owner = await session(client, org, ['owner'])

    await expectStatus(call(client, 'DELETE', '', owner, org).json({ confirmName: 'Doztra' }), 204)

    const row = await Organization.findOrFail(org.id)
    assert.isNotNull(row.deletedAt)
    assert.lengthOf(await auditCount(org, 'organization.deleted'), 1)
    await expectStatus(call(client, 'GET', '', owner, org), 403)

    const me = await expectStatus(client.get('/api/v1/me').bearerToken(owner.accessToken), 200)
    assert.lengthOf(me.body().data.organizations, 0)
  })

  test('a wrong name changes nothing; hr_admin is refused', async ({ client, assert }) => {
    const org = await createOrganization('Doztra')
    const owner = await session(client, org, ['owner'])
    const admin = await session(client, org, ['hr_admin'])

    const wrong = await expectStatus(
      call(client, 'DELETE', '', owner, org).json({ confirmName: 'doztra' }),
      422
    )
    assert.equal(errorOf(wrong).details[0].rule, 'mismatch')
    await expectStatus(call(client, 'DELETE', '', admin, org).json({ confirmName: 'Doztra' }), 403)
    const row = await Organization.findOrFail(org.id)
    assert.isNull(row.deletedAt)
  })

  test('its pending invitations stop working', async ({ client }) => {
    const org = await createOrganization('Doztra')
    const owner = await session(client, org, ['owner'])
    const { token } = await createInvitation(org)
    await expectStatus(call(client, 'DELETE', '', owner, org).json({ confirmName: 'Doztra' }), 204)

    await expectStatus(
      client.request(`/api/v1/auth/invitations/${token}/accept`, 'POST').json({
        password: 'Konakry-Rh-2026',
        password_confirmation: 'Konakry-Rh-2026',
      }),
      404
    )
  })
})
