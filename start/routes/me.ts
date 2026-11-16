import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const MeController = () => import('#modules/users/controllers/me_controller')

/** `/api/v1/me/*` — 06-api-reference §2 (notifications, export, deletion: later modules). */
export function registerMeRoutes() {
  router
    .group(() => {
      router.get('/', [MeController, 'show']).as('show')
      router.patch('/', [MeController, 'update']).as('update')
      router.post('password', [MeController, 'changePassword']).as('changePassword')
      router.get('sessions', [MeController, 'sessions']).as('sessions')
      router.delete('sessions/:id', [MeController, 'revokeSession']).as('revokeSession')
      router.get('organizations', [MeController, 'organizations']).as('organizations')
    })
    .prefix('me')
    .as('me')
    .use([middleware.auth(), throttleUser])
}
