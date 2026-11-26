import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const MeController = () => import('#modules/users/controllers/me_controller')
const NotificationsController = () =>
  import('#modules/notifications/controllers/notifications_controller')

/** `/api/v1/me/*` — 06-api-reference §2. */
export function registerMeRoutes() {
  router
    .group(() => {
      router.get('/', [MeController, 'show']).as('show')
      router.delete('/', [MeController, 'destroy']).as('destroy').use(middleware.notImpersonating())
      router.patch('/', [MeController, 'update']).as('update').use(middleware.notImpersonating())
      router
        .post('password', [MeController, 'changePassword'])
        .as('changePassword')
        .use(middleware.notImpersonating())
      router.get('sessions', [MeController, 'sessions']).as('sessions')
      router
        .delete('sessions/:id', [MeController, 'revokeSession'])
        .as('revokeSession')
        .use(middleware.notImpersonating())
      router.get('organizations', [MeController, 'organizations']).as('organizations')
      // Notifications of the current organization: `X-Organization-Id` is required.
      router
        .group(() => {
          router.get('/', [NotificationsController, 'index']).as('index')
          router.post('read-all', [NotificationsController, 'readAll']).as('readAll')
          router.post(':id/read', [NotificationsController, 'read']).as('read')
        })
        .prefix('notifications')
        .as('notifications')
        .use(middleware.tenant())
    })
    .prefix('me')
    .as('me')
    .use([middleware.auth(), throttleUser])
}
