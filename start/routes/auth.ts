import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const AuthController = () => import('#modules/auth/controllers/auth_controller')

/** `/api/v1/auth/*` — 06-api-reference §1. */
export function registerAuthRoutes() {
  router
    .group(() => {
      router.post('register', [AuthController, 'register']).as('register')
      router.post('login', [AuthController, 'login']).as('login')
      router.post('refresh', [AuthController, 'refresh']).as('refresh')
      router.post('forgot-password', [AuthController, 'forgotPassword']).as('forgotPassword')
      router.post('reset-password', [AuthController, 'resetPassword']).as('resetPassword')
      router.post('verify-email', [AuthController, 'verifyEmail']).as('verifyEmail')
      router.get('invitations/:token', [AuthController, 'invitation']).as('invitations.show')
      router
        .post('invitations/:token/accept', [AuthController, 'acceptInvitation'])
        .as('invitations.accept')

      router
        .group(() => {
          router.post('logout', [AuthController, 'logout']).as('logout')
          router.post('logout-all', [AuthController, 'logoutAll']).as('logoutAll')
          router
            .post('resend-verification', [AuthController, 'resendVerification'])
            .as('resendVerification')
        })
        .use([middleware.auth(), throttleUser])
    })
    .prefix('auth')
    .as('auth')
}
