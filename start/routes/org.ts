import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const InvitationsController = () =>
  import('#modules/invitations/controllers/invitations_controller')

const EntitlementsController = () => import('#modules/billing/controllers/entitlements_controller')

/**
 * `/api/v1/org/*` — 06-api-reference §3 onwards. Every route runs behind
 * `auth` then `tenant` (X-Organization-Id, docs/backend/01 §4).
 */
export function registerOrgRoutes() {
  router
    .group(() => {
      router.get('entitlements', [EntitlementsController, 'show']).as('entitlements.show')

      router
        .group(() => {
          router.get('/', [InvitationsController, 'index']).as('index')
          router
            .post('/', [InvitationsController, 'store'])
            .as('store')
            .use(middleware.idempotency())
          router.post(':id/resend', [InvitationsController, 'resend']).as('resend')
          router.delete(':id', [InvitationsController, 'destroy']).as('destroy')
        })
        .prefix('invitations')
        .as('invitations')
    })
    .prefix('org')
    .as('org')
    .use([middleware.auth(), throttleUser, middleware.tenant()])
}
