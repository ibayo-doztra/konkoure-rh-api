import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import UsageEvent from '#models/usage_event'
import organizationPurgeService from '#modules/organizations/services/organization_purge_service'
import { createHrOrganization } from '#tests/helpers/hr'

/** A failed statement would abort the global test transaction: run it in a savepoint. */
function inSavepoint(organizationId: string) {
  return db.transaction((trx) => trx.rawQuery('SELECT purge_append_only_rows(?)', [organizationId]))
}

async function can(role: string, table: string, privilege: string) {
  const result = await db.rawQuery('SELECT has_table_privilege(?, ?, ?) AS allowed', [
    role,
    table,
    privilege,
  ])
  return result.rows[0].allowed as boolean
}

test.group('SQL roles (0140_grants_roles)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake('s3')
    drive.fake('s3Public')
    return () => {
      drive.restore('s3')
      drive.restore('s3Public')
    }
  })

  test('konkoure_readonly reads business tables, not credentials', async ({ assert }) => {
    const role = await db.rawQuery(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'konkoure_readonly'`
    )
    assert.isTrue(role.rows[0].rolbypassrls)
    for (const table of ['employees', 'organizations', 'time_logs', 'work_schedules']) {
      assert.isTrue(await can('konkoure_readonly', table, 'SELECT'), table)
    }
    for (const table of [
      'users',
      'auth_access_tokens',
      'auth_refresh_tokens',
      'social_accounts',
      'payments',
      'password_reset_tokens',
      'invitations',
      'device_tokens',
      'platform_settings',
      'webhook_receipts',
    ]) {
      assert.isFalse(await can('konkoure_readonly', table, 'SELECT'), table)
    }
    assert.isFalse(await can('konkoure_readonly', 'employees', 'UPDATE'))
  })

  test('insert-only tables refuse UPDATE and DELETE to both roles', async ({ assert }) => {
    for (const role of ['konkoure_app', 'konkoure_worker']) {
      for (const table of [
        'audit_logs',
        'usage_events',
        'candidate_events',
        'leave_balance_ledger',
        'nfc_badge_events',
      ]) {
        assert.isTrue(await can(role, table, 'INSERT'), `${role} ${table}`)
        assert.isFalse(await can(role, table, 'DELETE'), `${role} ${table}`)
        assert.isFalse(await can(role, table, 'UPDATE'), `${role} ${table}`)
      }
    }
  })

  test('purge_append_only_rows refuses an organization not due', async ({ assert }) => {
    const org = await createHrOrganization()
    await assert.rejects(() => inSavepoint(org.id), /not due for purge/)
    org.merge({ deletedAt: DateTime.now().minus({ days: 29 }) })
    await org.save()
    await assert.rejects(() => inSavepoint(org.id), /not due for purge/)
  })

  test('the purge empties insert-only tables as konkoure_worker', async ({ assert }) => {
    const org = await createHrOrganization()
    await UsageEvent.create({ organizationId: org.id, kind: 'ai_call', module: 'ai', metadata: {} })
    org.merge({ deletedAt: DateTime.now().minus({ days: 31 }) })
    await org.save()

    await db.rawQuery('SET LOCAL ROLE konkoure_worker')
    const purged = await organizationPurgeService.run()
    await db.rawQuery('RESET ROLE')

    assert.equal(purged, 1)
    const left = await db.rawQuery(
      'SELECT count(*)::int AS count FROM usage_events WHERE organization_id = ?',
      [org.id]
    )
    assert.equal(left.rows[0].count, 0)
  })
})
