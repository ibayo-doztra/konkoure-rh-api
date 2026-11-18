import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Organization from '#models/organization'
import UserRole from '#models/user_role'
import memberService from '#modules/organizations/services/member_service'
import organizationService from '#modules/organizations/services/organization_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { createOrganization, createUser, grantRoles } from '#tests/helpers/auth'

test.group('/org services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('every mutation works with RLS enforced', async ({ assert }) => {
    const org = await createOrganization('Doztra')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    const target = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    await grantRoles(target, org, ['employee'])
    const tenant = new TenantContext(org.id, ['owner'])

    // Lasts until the global transaction rolls back at the end of the test.
    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    const { rows } = await db.rawQuery('select current_user as role')
    assert.equal(rows[0].role, 'konkoure_app')

    await organizationService.update(tenant, owner, { name: 'Doztra SA' }, {})
    await organizationService.updateSettings(tenant, owner, { leave: { maxNegativeDays: 1 } }, {})

    const listed = await memberService.list(tenant, { page: 1, perPage: 25 })
    assert.equal(listed.meta.total, 2)
    const updated = await memberService.updateRoles(tenant, owner, target.id, ['manager'], {})
    assert.deepEqual(updated.roles, ['manager'])
    await memberService.remove(tenant, target.id, {})
    await organizationService.remove(tenant, owner, 'Doztra SA', {})

    const remaining = await UserRole.query().where('user_id', target.id)
    assert.lengthOf(remaining, 0)
    const row = await Organization.findOrFail(org.id)
    assert.isNotNull(row.deletedAt)
  })
})
