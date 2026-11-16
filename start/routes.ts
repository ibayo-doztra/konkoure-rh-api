/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| One file per module in start/routes/, all under /api/v1 (docs/backend/01 §5).
|
*/

import router from '@adonisjs/core/services/router'
import { throttleIp } from '#start/limiter'
import { registerAuthRoutes } from '#start/routes/auth'
import { registerMeRoutes } from '#start/routes/me'

/** Liveness probe (docs/backend/06 §14). */
router.get('/health', () => ({ status: 'ok' }))

router
  .group(() => {
    registerAuthRoutes()
    registerMeRoutes()
  })
  .prefix('/api/v1')
  .use(throttleIp)
