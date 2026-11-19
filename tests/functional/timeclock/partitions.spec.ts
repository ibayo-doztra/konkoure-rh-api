import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import partitionService from '#shared/maintenance/partition_service'

test.group('partitions:ensure', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates the missing months ahead, once', async ({ assert }) => {
    const later = DateTime.utc().plus({ years: 3 })
    assert.equal(await partitionService.ensure(later), 4)
    assert.equal(await partitionService.ensure(later), 0)
    const name = `time_logs_${later.startOf('month').plus({ months: 3 }).toFormat('yyyy_MM')}`
    const found = await db.rawQuery('select to_regclass(?) as oid', [name])
    assert.isNotNull(found.rows[0].oid)
  })
})
