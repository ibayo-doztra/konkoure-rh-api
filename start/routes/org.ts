import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const InvitationsController = () =>
  import('#modules/invitations/controllers/invitations_controller')

const EntitlementsController = () => import('#modules/billing/controllers/entitlements_controller')

const CurrentOrganizationController = () =>
  import('#modules/organizations/controllers/current_organization_controller')

const MembersController = () => import('#modules/organizations/controllers/members_controller')

const DepartmentsController = () => import('#modules/hr/controllers/departments_controller')
const EmployeesController = () => import('#modules/hr/controllers/employees_controller')

/**
 * `/api/v1/org/*` — 06-api-reference §3 onwards. Every route runs behind
 * `auth` then `tenant` (X-Organization-Id, docs/backend/01 §4).
 */
export function registerOrgRoutes() {
  router
    .group(() => {
      router.get('/', [CurrentOrganizationController, 'show']).as('show')
      router.patch('/', [CurrentOrganizationController, 'update']).as('update')
      router.delete('/', [CurrentOrganizationController, 'destroy']).as('destroy')
      router
        .put('settings', [CurrentOrganizationController, 'updateSettings'])
        .as('settings.update')
      router.post('logo', [CurrentOrganizationController, 'uploadLogo']).as('logo.store')

      router.get('entitlements', [EntitlementsController, 'show']).as('entitlements.show')

      router
        .group(() => {
          router.get('/', [MembersController, 'index']).as('index')
          router.patch(':userId/roles', [MembersController, 'updateRoles']).as('roles.update')
          router.delete(':userId', [MembersController, 'destroy']).as('destroy')
        })
        .prefix('members')
        .as('members')

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

      router
        .group(() => {
          router
            .group(() => {
              router.get('/', [DepartmentsController, 'index']).as('index')
              router.post('/', [DepartmentsController, 'store']).as('store')
              router.get(':id', [DepartmentsController, 'show']).as('show')
              router.patch(':id', [DepartmentsController, 'update']).as('update')
              router.delete(':id', [DepartmentsController, 'destroy']).as('destroy')
              router.get(':id/employees', [DepartmentsController, 'employees']).as('employees')
            })
            .prefix('departments')
            .as('departments')

          router
            .group(() => {
              router.get('/', [EmployeesController, 'index']).as('index')
              router.post('/', [EmployeesController, 'store']).as('store')
              // Before `:id`, which would otherwise capture it.
              router.get('managers', [EmployeesController, 'managers']).as('managers')
              router.get(':id', [EmployeesController, 'show']).as('show')
              router.patch(':id', [EmployeesController, 'update']).as('update')
              router.delete(':id', [EmployeesController, 'destroy']).as('destroy')
              router.post(':id/restore', [EmployeesController, 'restore']).as('restore')
              router.get(':id/salary', [EmployeesController, 'salary']).as('salary')
              router.get(':id/team', [EmployeesController, 'team']).as('team')
            })
            .prefix('employees')
            .as('employees')
        })
        .use(middleware.entitlement({ module: 'hr' }))
    })
    .prefix('org')
    .as('org')
    .use([middleware.auth(), throttleUser, middleware.tenant()])
}
