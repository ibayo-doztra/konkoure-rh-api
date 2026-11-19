import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'

/** Team of a manager, cached 5 minutes (docs/backend/04 §6). */
const TTL_SECONDS = 5 * 60
const key = (organizationId: string, managerId: string) => `mgr:${organizationId}:${managerId}`

/**
 * Descendants of a manager (`manager_id` tree). The cache only saves the
 * recursive query: a Redis outage falls back to PostgreSQL. It is cleared for
 * the whole organization after any committed change of the hierarchy.
 */
export class TeamCache {
  async get(organizationId: string, managerId: string): Promise<string[] | null> {
    try {
      const raw = await redis.connection('cache').get(key(organizationId, managerId))
      return raw ? (JSON.parse(raw) as string[]) : null
    } catch (error) {
      logger.warn({ err: error }, 'team_cache.unavailable')
      return null
    }
  }

  async set(organizationId: string, managerId: string, ids: string[]) {
    try {
      await redis
        .connection('cache')
        .set(key(organizationId, managerId), JSON.stringify(ids), 'EX', TTL_SECONDS)
    } catch (error) {
      logger.warn({ err: error }, 'team_cache.unavailable')
    }
  }

  /** After the commit of a change of `manager_id`, department or employee set. */
  async invalidate(organizationId: string) {
    try {
      const connection = redis.connection('cache')
      // ioredis prefixes DEL keys but neither SCAN patterns nor the keys it returns.
      const prefix = connection.ioConnection.options.keyPrefix ?? ''
      let cursor = '0'
      do {
        const [next, keys] = await connection.scan(
          cursor,
          'MATCH',
          `${prefix}mgr:${organizationId}:*`,
          'COUNT',
          500
        )
        cursor = next
        const unprefixed = keys.map((found) => found.slice(prefix.length))
        if (unprefixed.length > 0) await connection.del(...unprefixed)
      } while (cursor !== '0')
    } catch (error) {
      logger.warn({ err: error }, 'team_cache.unavailable')
    }
  }
}

export default new TeamCache()
