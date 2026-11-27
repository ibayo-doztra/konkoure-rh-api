import { test } from '@japa/runner'
import { DateTime } from 'luxon'
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

test.group('platform:grant in production (decision of 2026-11-27)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const production = { production: true }
  const verified = () => ({ emailVerifiedAt: DateTime.now(), isActive: true })

  test('bootstraps the first root, journaled as such', async ({ assert }) => {
    await PlatformAdmin.query().where('level', 'root').update({ isActive: false })
    const user = await createUser({ email: 'founder@konkoure.test', ...verified() })

    const created = await platformGrantService.grant('founder@konkoure.test', 'root', production)
    assert.deepInclude(created.$attributes, { userId: user.id, level: 'root', isActive: true })

    const entry = await AuditLog.query().where('target_id', user.id).firstOrFail()
    assert.equal(entry.action, 'platform_admin.granted')
    assert.deepEqual(entry.afterData, { level: 'root', bootstrap: true })
  })

  test('refuses once an active root exists', async ({ assert }) => {
    await PlatformAdmin.query().where('level', 'root').update({ isActive: false })
    const root = await createUser(verified())
    await PlatformAdmin.create({ userId: root.id, level: 'root', isActive: true })
    const other = await createUser({ email: 'second@konkoure.test', ...verified() })

    await assert.rejects(
      () => platformGrantService.grant('second@konkoure.test', 'root', production),
      /already exists/
    )
    assert.isNull(await PlatformAdmin.findBy('user_id', other.id))
  })

  test('refuses support, revocation, unverified or inactive accounts', async ({ assert }) => {
    await PlatformAdmin.query().where('level', 'root').update({ isActive: false })
    await createUser({ email: 'pending@konkoure.test', isActive: true })
    await createUser({
      email: 'banned@konkoure.test',
      emailVerifiedAt: DateTime.now(),
      isActive: false,
    })

    await assert.rejects(
      () => platformGrantService.grant('pending@konkoure.test', 'support', production),
      /only creates the first root/
    )
    await assert.rejects(
      () => platformGrantService.revoke('pending@konkoure.test', production),
      /disabled in production/
    )
    await assert.rejects(
      () => platformGrantService.grant('pending@konkoure.test', 'root', production),
      /not verified/
    )
    await assert.rejects(
      () => platformGrantService.grant('banned@konkoure.test', 'root', production),
      /inactive/
    )
    const roots = await PlatformAdmin.query().where('level', 'root').where('is_active', true)
    assert.lengthOf(roots, 0)
  })
})
