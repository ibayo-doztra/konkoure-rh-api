import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import NfcBadge from '#models/nfc_badge'
import Notification from '#models/notification'
import badgeService from '#modules/timeclock/services/badge_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { createEmployee, createHrOrganization } from '#tests/helpers/hr'

/**
 * Without the global test transaction, as in production: the default
 * connection cannot see rows of a transaction that is not committed yet.
 * The other suites wrap everything in one transaction and hide such bugs.
 */
test.group('Badge assignment outside a test transaction', (group) => {
  group.each.setup(() => limiter.clear(['memory']))

  test('assigning a badge returns it once committed', async ({ assert, cleanup }) => {
    const org = await createHrOrganization('Badge commit')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    const holder = await createUser({ emailVerifiedAt: DateTime.now() })
    cleanup(async () => {
      await org.delete()
      await owner.delete()
      await holder.delete()
    })
    await grantRoles(owner, org, ['owner'])
    await grantRoles(holder, org, ['employee'])
    const worker = await createEmployee(org, { userId: holder.id })
    const tenant = new TenantContext(org.id, ['owner'])

    const badge = await badgeService.assign(tenant, owner, worker.id, '0C9C6B3E', {})
    assert.equal(badge.employeeId, worker.id)
    assert.isTrue(badge.isActive)
    assert.equal(badge.uidMasked, '••••6B3E')
    const stored = await NfcBadge.findOrFail(badge.id)
    assert.equal(stored.employeeId, worker.id)
    // The holder's notification is written after the commit, in its own transaction.
    const notified = await Notification.query().where('user_id', holder.id)
    assert.lengthOf(notified, 1)
    assert.equal(notified[0].type, 'badge.assigned')

    // A second assignment replaces the first one (reassigned).
    const next = await badgeService.assign(tenant, owner, worker.id, '0A0B0C0D', {})
    assert.notEqual(next.id, badge.id)
    const replaced = await NfcBadge.findOrFail(badge.id)
    assert.isNotNull(replaced.revokedAt)
  })
})
