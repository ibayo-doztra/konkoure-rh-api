import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import partitionService from '#shared/maintenance/partition_service'

test.group('partitions:ensure', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates the missing months ahead, once', async ({ assert }) => {
    const later = DateTime.utc().plus({ years: 3 })
    // 4 months for each of time_logs and audit_logs.
    assert.equal(await partitionService.ensure(later), 8)
    assert.equal(await partitionService.ensure(later), 0)
    const month = later.startOf('month').plus({ months: 3 }).toFormat('yyyy_MM')
    for (const table of ['time_logs', 'audit_logs']) {
      const found = await db.rawQuery('select to_regclass(?) as oid', [`${table}_${month}`])
      assert.isNotNull(found.rows[0].oid)
    }
  })

  test('the bootstrap partitioned the 12 coming months of both tables', async ({ assert }) => {
    const start = DateTime.utc().startOf('month')
    for (const table of ['time_logs', 'audit_logs']) {
      for (let step = 0; step < 12; step += 1) {
        const name = `${table}_${start.plus({ months: step }).toFormat('yyyy_MM')}`
        const found = await db.rawQuery('select to_regclass(?) as oid', [name])
        assert.isNotNull(found.rows[0].oid, name)
      }
    }
  })
})
