import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const OrganizationsController = () =>
  import('#modules/organizations/controllers/organizations_controller')

/** `POST /api/v1/organizations` — 06-api-reference §3 (verified e-mail required). */
export function registerOrganizationRoutes() {
  router
    .post('organizations', [OrganizationsController, 'store'])
    .as('organizations.store')
    .use([middleware.auth(), throttleUser])
}
