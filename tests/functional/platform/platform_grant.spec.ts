import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AuditLog from '#models/audit_log'
import PlatformAdmin from '#models/platform_admin'
import platformGrantService from '#modules/platform/services/platform_grant_service'
import { createUser } from '#tests/helpers/auth'

test.group('platform:grant (decision of 2026-11-25)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates, changes and revokes a platform admin, journaled', async ({ assert }) => {
    const user = await createUser({ email: 'Admin@Konkoure.test' })

    const created = await platformGrantService.grant('admin@konkoure.test', 'support')
    assert.deepInclude(created.$attributes, { userId: user.id, level: 'support', isActive: true })

    await platformGrantService.grant('admin@konkoure.test', 'root')
    const admins = await PlatformAdmin.query().where('user_id', user.id)
    assert.lengthOf(admins, 1)
    assert.equal(admins[0].level, 'root')

    assert.isTrue(await platformGrantService.revoke('admin@konkoure.test'))
    await admins[0].refresh()
    assert.isFalse(admins[0].isActive)
    assert.isFalse(await platformGrantService.revoke('admin@konkoure.test'))

    // A revoked admin can be granted again.
    await platformGrantService.grant('admin@konkoure.test', 'support')
    await admins[0].refresh()
    assert.deepInclude(admins[0].$attributes, { level: 'support', isActive: true })

    const actions = await AuditLog.query()
      .where('target_id', user.id)
      .orderBy('created_at', 'asc')
      .select('action')
    assert.deepEqual(
      actions.map((entry) => entry.action),
      [
        'platform_admin.granted',
        'platform_admin.granted',
        'platform_admin.revoked',
        'platform_admin.granted',
      ]
    )
  })

  test('refuses an unknown level or account', async ({ assert }) => {
    await createUser({ email: 'someone@konkoure.test' })
    await assert.rejects(
      () => platformGrantService.grant('someone@konkoure.test', 'owner'),
      /Unknown level/
    )
    await assert.rejects(
      () => platformGrantService.grant('nobody@konkoure.test', 'root'),
      /No account/
    )
    await assert.rejects(() => platformGrantService.revoke('nobody@konkoure.test'), /No account/)
  })
})
