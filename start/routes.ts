/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| One file per module in start/routes/, all under /api/v1 (docs/backend/01 §5).
|
*/

import router from '@adonisjs/core/services/router'
import openapi from '@foadonis/openapi/services/main'
import env from '#start/env'
import { throttleIp } from '#start/limiter'
import { registerAuthRoutes } from '#start/routes/auth'
import { registerMeRoutes } from '#start/routes/me'
import { registerOrganizationRoutes } from '#start/routes/organizations'
import { registerOrgRoutes } from '#start/routes/org'
import { registerPublicRoutes } from '#start/routes/public'

const HealthController = () => import('#modules/health/controllers/health_controller')

/** Probes (docs/backend/06 §14). */
router.get('/health', [HealthController, 'show']).as('health.show')
router.get('/health/ready', [HealthController, 'ready']).as('health.ready')

/** Interactive docs (`/docs`, `/docs.json`, `/docs.yaml`), never exposed in production. */
if (env.get('NODE_ENV') !== 'production') {
  openapi.registerRoutes('/docs')
}

router
  .group(() => {
    registerAuthRoutes()
    registerMeRoutes()
    registerOrganizationRoutes()
    registerOrgRoutes()
    registerPublicRoutes()
  })
  .prefix('/api/v1')
  .use(throttleIp)
