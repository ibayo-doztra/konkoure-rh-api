import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import badgeService from '#modules/timeclock/services/badge_service'
import deviceTokenService from '#modules/timeclock/services/device_token_service'
import punchService from '#modules/timeclock/services/punch_service'
import timeLogService from '#modules/timeclock/services/time_log_service'
import zoneService from '#modules/timeclock/services/zone_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { withTenant } from '#shared/tenant/with_tenant'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { createEmployee, createHrOrganization } from '#tests/helpers/hr'
import { KALOUM, NEAR, createPunch, giveBadge } from '#tests/helpers/timeclock'

test.group('Timeclock services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the whole flow works with RLS enforced, which hides other tenants', async ({ assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const worker = await createEmployee(org)
    const foreign = await createPunch(await createEmployee(other))
    await giveBadge(await createEmployee(other), 'CAFEBABE')
    const tenant = new TenantContext(org.id, ['owner'])

    // Lasts until the global transaction rolls back at the end of the test.
    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    await zoneService.create(tenant, owner, { name: 'Siège', ...KALOUM, radiusMeters: 200 }, {})
    await badgeService.assign(tenant, owner, worker.id, '0C9C6B3E', {})
    const actor = { kind: 'user' as const, user: owner }
    const scanned = await punchService.scan(tenant, actor, '0c:9c:6b:3e', NEAR, null)
    assert.isTrue(scanned.log.isWithinZone)
    await assert.rejects(() => punchService.scan(tenant, actor, 'CAFEBABE', {}, null))

    const { token } = await deviceTokenService.create(tenant, owner, { name: 'Hall' }, {})
    const device = await deviceTokenService.authenticate(token)
    assert.equal(device?.organizationId, org.id)

    await timeLogService.correct(tenant, scanned.log.id, { notes: 'Vérifié' }, {})
    const { rows } = await timeLogService.list(tenant, {})
    assert.deepEqual(
      rows.map((row) => row.id),
      [scanned.log.id]
    )
    await assert.rejects(() => timeLogService.remove(tenant, foreign.id, {}))
  })

  test('the badge journal is insert only for the application role', async ({ assert }) => {
    const org = await createHrOrganization()
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const tenant = new TenantContext(org.id, ['owner'])
    const employee = await createEmployee(org)
    await badgeService.assign(tenant, owner, employee.id, '0A0B0C0D', {})

    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    await assert.rejects(() =>
      withTenant(org.id, (trx) =>
        trx.from('nfc_badge_events').where('organization_id', org.id).update({ reason: 'x' })
      )
    )
  })
})
