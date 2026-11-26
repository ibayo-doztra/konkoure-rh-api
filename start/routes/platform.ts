import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const PlatformOrganizationsController = () =>
  import('#modules/platform/controllers/platform_organizations_controller')
const PlatformPlansController = () =>
  import('#modules/platform/controllers/platform_plans_controller')
const PlatformUsersController = () =>
  import('#modules/platform/controllers/platform_users_controller')
const PlatformOperationsController = () =>
  import('#modules/platform/controllers/platform_operations_controller')

/**
 * `/api/v1/platform/*` — back office (06 §13). `auth` then `platform` (active
 * platform admin); `support` or `root` is checked by `PlatformPolicy`.
 */
export function registerPlatformRoutes() {
  router
    .group(() => {
      router.get('dashboard', [PlatformOrganizationsController, 'dashboard']).as('dashboard')

      router
        .group(() => {
          router.get('/', [PlatformOrganizationsController, 'index']).as('index')
          router.get(':id', [PlatformOrganizationsController, 'show']).as('show')
          router
            .patch(':id/subscription', [PlatformOrganizationsController, 'updateSubscription'])
            .as('subscription.update')
          router.post(':id/suspend', [PlatformOrganizationsController, 'suspend']).as('suspend')
          router
            .post(':id/reactivate', [PlatformOrganizationsController, 'reactivate'])
            .as('reactivate')
          router.post(':id/restore', [PlatformOrganizationsController, 'restore']).as('restore')
        })
        .prefix('organizations')
        .as('organizations')

      router
        .group(() => {
          router.get('/', [PlatformPlansController, 'index']).as('index')
          router.post('/', [PlatformPlansController, 'store']).as('store')
          router.patch(':id', [PlatformPlansController, 'update']).as('update')
          router.delete(':id', [PlatformPlansController, 'destroy']).as('destroy')
        })
        .prefix('plans')
        .as('plans')

      router
        .group(() => {
          router.get('/', [PlatformUsersController, 'index']).as('index')
          router.patch(':id/roles', [PlatformUsersController, 'updateRoles']).as('roles.update')
          router.post(':id/ban', [PlatformUsersController, 'ban']).as('ban')
          router.post(':id/unban', [PlatformUsersController, 'unban']).as('unban')
          router.post(':id/impersonate', [PlatformUsersController, 'impersonate']).as('impersonate')
        })
        .prefix('users')
        .as('users')

      router
        .group(() => {
          router.get('/', [PlatformUsersController, 'admins']).as('index')
          router.post('/', [PlatformUsersController, 'grantAdmin']).as('store')
          router.delete(':userId', [PlatformUsersController, 'revokeAdmin']).as('destroy')
        })
        .prefix('admins')
        .as('admins')

      router.get('settings', [PlatformOperationsController, 'settings']).as('settings.show')
      router.put('settings', [PlatformOperationsController, 'updateSettings']).as('settings.update')
      router.get('payments', [PlatformOperationsController, 'payments']).as('payments.index')
      router
        .post('payments/:id/reconcile', [PlatformOperationsController, 'reconcile'])
        .as('payments.reconcile')
      router
        .get('demo-requests', [PlatformOperationsController, 'demoRequests'])
        .as('demoRequests.index')
      router
        .patch('demo-requests/:id', [PlatformOperationsController, 'updateDemoRequest'])
        .as('demoRequests.update')
      router.get('logs/:kind', [PlatformOperationsController, 'logs']).as('logs')
      router.get('health', [PlatformOperationsController, 'health']).as('health')
    })
    .prefix('platform')
    .as('platform')
    .use([middleware.auth(), throttleUser, middleware.notImpersonating(), middleware.platform()])
}
