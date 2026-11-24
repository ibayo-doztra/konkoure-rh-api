import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

/**
 * @platformScope — query client of the back office's cross-organization reads
 * (docs/backend/05 §1). Under the application role (`DB_APP_ROLE`), it is the
 * `platform` connection, which takes `konkoure_worker` (BYPASSRLS); otherwise
 * (superuser, tests) the default connection. Never used by tenant code, and
 * never for writes: mutations of an organization go through `withTenant`.
 */
export function platformClient() {
  const appRole = app.getEnvironment() === 'web' ? env.get('DB_APP_ROLE') : undefined
  return appRole ? db.connection('platform') : db.connection()
}
