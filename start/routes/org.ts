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
const ContractsController = () => import('#modules/hr/controllers/contracts_controller')
const SkillsController = () => import('#modules/hr/controllers/skills_controller')
const LeavesController = () => import('#modules/leaves/controllers/leaves_controller')
const LeaveBalancesController = () =>
  import('#modules/leaves/controllers/leave_balances_controller')
const HolidaysController = () => import('#modules/leaves/controllers/holidays_controller')

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
              router.get(':id/skills', [SkillsController, 'ofEmployee']).as('skills.index')
              router.put(':id/skills', [SkillsController, 'replaceOfEmployee']).as('skills.replace')
            })
            .prefix('employees')
            .as('employees')

          router
            .group(() => {
              router.get('/', [ContractsController, 'index']).as('index')
              router.post('/', [ContractsController, 'store']).as('store')
              router.get(':id', [ContractsController, 'show']).as('show')
              router.patch(':id', [ContractsController, 'update']).as('update')
              router.delete(':id', [ContractsController, 'destroy']).as('destroy')
              router.post(':id/terminate', [ContractsController, 'terminate']).as('terminate')
              router.get(':id/document', [ContractsController, 'document']).as('document')
            })
            .prefix('contracts')
            .as('contracts')

          router
            .group(() => {
              router.get('/', [SkillsController, 'index']).as('index')
              router.post('/', [SkillsController, 'store']).as('store')
              router.patch(':id', [SkillsController, 'update']).as('update')
              router.delete(':id', [SkillsController, 'destroy']).as('destroy')
            })
            .prefix('skills')
            .as('skills')
        })
        .use(middleware.entitlement({ module: 'hr' }))

      router
        .group(() => {
          router
            .group(() => {
              router.get('/', [LeavesController, 'index']).as('index')
              router
                .post('/', [LeavesController, 'store'])
                .as('store')
                .use(middleware.idempotency())
              router.get('balances', [LeaveBalancesController, 'index']).as('balances.index')
              router
                .post('balances/adjust', [LeaveBalancesController, 'adjust'])
                .as('balances.adjust')
              router.get(':id', [LeavesController, 'show']).as('show')
              router.patch(':id', [LeavesController, 'update']).as('update')
              router.post(':id/approve', [LeavesController, 'approve']).as('approve')
              router.post(':id/reject', [LeavesController, 'reject']).as('reject')
              router.post(':id/cancel', [LeavesController, 'cancel']).as('cancel')
            })
            .prefix('leaves')
            .as('leaves')

          router
            .group(() => {
              router.get('/', [HolidaysController, 'index']).as('index')
              router.post('/', [HolidaysController, 'store']).as('store')
              router.post('import', [HolidaysController, 'import']).as('import')
              router.patch(':id', [HolidaysController, 'update']).as('update')
              router.delete(':id', [HolidaysController, 'destroy']).as('destroy')
            })
            .prefix('holidays')
            .as('holidays')
        })
        .use(middleware.entitlement({ module: 'leaves' }))
    })
    .prefix('org')
    .as('org')
    .use([middleware.auth(), throttleUser, middleware.tenant()])
}
