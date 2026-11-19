import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'

/** Monthly partitioned tables kept ahead by `partitions:ensure` (docs/backend/09 §4). */
const TABLES = ['time_logs'] as const
const MONTHS_AHEAD = 3

/**
 * `partitions:ensure` (08 §2, 03:30): creates the partitions of the current
 * month and the next three. Idempotent (`IF NOT EXISTS`). A month whose rows
 * already sit in the DEFAULT partition cannot be created: it is logged and
 * left for an operator, the other months still go through.
 */
export class PartitionService {
  async ensure(at: DateTime = DateTime.utc()) {
    let created = 0
    const failed: string[] = []
    for (const table of TABLES) {
      for (let step = 0; step <= MONTHS_AHEAD; step += 1) {
        const from = at.toUTC().startOf('month').plus({ months: step })
        const name = `${table}_${from.toFormat('yyyy_MM')}`
        try {
          const exists = await db.rawQuery('select to_regclass(?) as oid', [name])
          if (exists.rows[0]?.oid) continue
          // DDL takes no bound values: the bounds are ISO dates computed here, never input.
          const lower = from.toISODate()!
          const upper = from.plus({ months: 1 }).toISODate()!
          await db.rawQuery(
            `CREATE TABLE IF NOT EXISTS ?? PARTITION OF ?? FOR VALUES FROM ('${lower}') TO ('${upper}')`,
            [name, table]
          )
          created += 1
        } catch (error) {
          failed.push(name)
          logger.error({ err: error, partition: name }, 'partitions.ensure_failed')
        }
      }
    }
    logger.info({ created, failed: failed.length }, 'partitions.ensure_done')
    if (failed.length > 0) throw new Error(`partitions:ensure failed for ${failed.join(', ')}`)
    return created
  }
}

export default new PartitionService()
