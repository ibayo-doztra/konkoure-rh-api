import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { MigrationRunner } from '@adonisjs/lucid/migration'

type CheckResult = 'ok' | 'unavailable' | 'pending'

async function check(fn: () => Promise<CheckResult>): Promise<CheckResult> {
  try {
    return await fn()
  } catch {
    return 'unavailable'
  }
}

/** Probes of docs/backend/06 §14 and 11 §3. They never expose error details. */
export class HealthService {
  private version?: string

  async liveness() {
    this.version ??= (
      JSON.parse(await readFile(app.makePath('package.json'), 'utf8')) as { version: string }
    ).version
    return { status: 'ok', version: this.version, uptime: Math.round(process.uptime()) }
  }

  async readiness() {
    const [database, cache, migrations] = await Promise.all([
      check(async () => {
        await db.rawQuery('select 1')
        return 'ok'
      }),
      check(async () =>
        (await redis.connection('cache').ping()) === 'PONG' ? 'ok' : 'unavailable'
      ),
      check(async () => {
        const runner = new MigrationRunner(db, app, { direction: 'up', dryRun: true })
        const list = await runner.getList()
        return list.some((migration) => migration.status === 'pending') ? 'pending' : 'ok'
      }),
    ])
    const checks = { database, redis: cache, migrations }
    const ready = Object.values(checks).every((result) => result === 'ok')
    return { ready, body: { status: ready ? 'ok' : 'unavailable', checks } }
  }
}

export default new HealthService()
