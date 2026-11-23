import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleUser } from '#start/limiter'

const InvitationsController = () =>
  import('#modules/invitations/controllers/invitations_controller')

const EntitlementsController = () => import('#modules/billing/controllers/entitlements_controller')
const DashboardController = () => import('#modules/dashboard/controllers/dashboard_controller')

const CurrentOrganizationController = () =>
  import('#modules/organizations/controllers/current_organization_controller')

const MembersController = () => import('#modules/organizations/controllers/members_controller')

const DepartmentsController = () => import('#modules/hr/controllers/departments_controller')
const EmployeesController = () => import('#modules/hr/controllers/employees_controller')
const ContractsController = () => import('#modules/hr/controllers/contracts_controller')
const EmployeeTransfersController = () =>
  import('#modules/hr/controllers/employee_transfers_controller')
const SkillsController = () => import('#modules/hr/controllers/skills_controller')
const LeavesController = () => import('#modules/leaves/controllers/leaves_controller')
const LeaveBalancesController = () =>
  import('#modules/leaves/controllers/leave_balances_controller')
const HolidaysController = () => import('#modules/leaves/controllers/holidays_controller')
const PerformanceSetupController = () =>
  import('#modules/performance/controllers/performance_setup_controller')
const GoalsController = () => import('#modules/performance/controllers/goals_controller')
const OkrsController = () => import('#modules/performance/controllers/okrs_controller')
const ReviewsController = () => import('#modules/performance/controllers/reviews_controller')
const FeedbackController = () => import('#modules/performance/controllers/feedback_controller')
const TimeclockController = () => import('#modules/timeclock/controllers/timeclock_controller')
const AttendanceController = () => import('#modules/timeclock/controllers/attendance_controller')
const TimeclockSetupController = () =>
  import('#modules/timeclock/controllers/timeclock_setup_controller')

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
      // Each block checks its own module, so no entitlement middleware here.
      router.get('dashboard', [DashboardController, 'show']).as('dashboard.show')

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
              router
                .post('import/preview', [EmployeeTransfersController, 'preview'])
                .as('import.preview')
              router
                .post('import/commit', [EmployeeTransfersController, 'commit'])
                .as('import.commit')
                .use(middleware.idempotency())
              router.post('export', [EmployeeTransfersController, 'export']).as('export')
              router.get(':id', [EmployeesController, 'show']).as('show')
              router.patch(':id', [EmployeesController, 'update']).as('update')
              router.delete(':id', [EmployeesController, 'destroy']).as('destroy')
              router.post(':id/restore', [EmployeesController, 'restore']).as('restore')
              router.get(':id/salary', [EmployeesController, 'salary']).as('salary')
              router.get(':id/team', [EmployeesController, 'team']).as('team')
              router.get(':id/documents', [EmployeesController, 'documents']).as('documents.index')
              router
                .post(':id/documents', [EmployeesController, 'storeDocument'])
                .as('documents.store')
              router
                .get(':id/documents/:docId/url', [EmployeesController, 'documentUrl'])
                .as('documents.url')
              router
                .delete(':id/documents/:docId', [EmployeesController, 'destroyDocument'])
                .as('documents.destroy')
              router.post(':id/photo', [EmployeesController, 'photo']).as('photo')
              router.get(':id/skills', [SkillsController, 'ofEmployee']).as('skills.index')
              router.put(':id/skills', [SkillsController, 'replaceOfEmployee']).as('skills.replace')
              router
                .get(':id/leave-balance', [LeaveBalancesController, 'ofEmployee'])
                .as('leaveBalance')
                .use(middleware.entitlement({ module: 'leaves' }))
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
              router
                .post(':id/document', [ContractsController, 'uploadDocument'])
                .as('document.store')
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
              router.get('calendar', [LeavesController, 'calendar']).as('calendar')
              router.get('balances', [LeaveBalancesController, 'index']).as('balances.index')
              router
                .post('balances/adjust', [LeaveBalancesController, 'adjust'])
                .as('balances.adjust')
              router.get(':id', [LeavesController, 'show']).as('show')
              router.patch(':id', [LeavesController, 'update']).as('update')
              router.post(':id/approve', [LeavesController, 'approve']).as('approve')
              router.post(':id/reject', [LeavesController, 'reject']).as('reject')
              router.post(':id/cancel', [LeavesController, 'cancel']).as('cancel')
              router.post(':id/attachment', [LeavesController, 'attach']).as('attachment.store')
              router.get(':id/attachment', [LeavesController, 'attachment']).as('attachment.show')
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

      router
        .group(() => {
          router
            .group(() => {
              router.get('/', [PerformanceSetupController, 'cycles']).as('index')
              router.post('/', [PerformanceSetupController, 'storeCycle']).as('store')
              router.patch(':id', [PerformanceSetupController, 'updateCycle']).as('update')
              router.post(':id/open', [PerformanceSetupController, 'openCycle']).as('open')
              router.post(':id/close', [PerformanceSetupController, 'closeCycle']).as('close')
            })
            .prefix('cycles')
            .as('cycles')

          router
            .group(() => {
              router.get('/', [PerformanceSetupController, 'plans']).as('index')
              router.post('/', [PerformanceSetupController, 'storePlan']).as('store')
              router.patch(':id', [PerformanceSetupController, 'updatePlan']).as('update')
              router.delete(':id', [PerformanceSetupController, 'destroyPlan']).as('destroy')
            })
            .prefix('plans')
            .as('plans')

          router
            .group(() => {
              router.get('/', [GoalsController, 'index']).as('index')
              router.post('/', [GoalsController, 'store']).as('store')
              router.get(':id', [GoalsController, 'show']).as('show')
              router.patch(':id', [GoalsController, 'update']).as('update')
              router.delete(':id', [GoalsController, 'destroy']).as('destroy')
              router.patch(':id/progress', [GoalsController, 'progress']).as('progress')
              router.get(':id/activities', [GoalsController, 'activities']).as('activities.index')
              router
                .post(':id/activities', [GoalsController, 'storeActivity'])
                .as('activities.store')
              router
                .patch(':id/activities/:activityId', [GoalsController, 'updateActivity'])
                .as('activities.update')
              router
                .delete(':id/activities/:activityId', [GoalsController, 'destroyActivity'])
                .as('activities.destroy')
            })
            .prefix('goals')
            .as('goals')

          router.get('activities', [GoalsController, 'allActivities']).as('activities.index')

          router
            .group(() => {
              router.get('/', [OkrsController, 'index']).as('index')
              router.post('/', [OkrsController, 'store']).as('store')
              router.get(':id', [OkrsController, 'show']).as('show')
              router.patch(':id', [OkrsController, 'update']).as('update')
              router.delete(':id', [OkrsController, 'destroy']).as('destroy')
              router.put(':id/key-results', [OkrsController, 'replaceKeyResults']).as('keyResults')
              router
                .patch(':id/key-results/:krId', [OkrsController, 'updateKeyResult'])
                .as('keyResults.update')
              router.post(':id/submit', [OkrsController, 'submit']).as('submit')
              router.post(':id/validate', [OkrsController, 'validate']).as('validate')
              router
                .post(':id/request-revision', [OkrsController, 'requestRevision'])
                .as('requestRevision')
              router.get(':id/checkins', [OkrsController, 'checkins']).as('checkins.index')
              router.post(':id/checkins', [OkrsController, 'storeCheckin']).as('checkins.store')
            })
            .prefix('okrs')
            .as('okrs')

          router
            .group(() => {
              router.get('/', [ReviewsController, 'index']).as('index')
              router
                .post('/', [ReviewsController, 'store'])
                .as('store')
                .use(middleware.idempotency())
              router.get(':id', [ReviewsController, 'show']).as('show')
              router.patch(':id/self', [ReviewsController, 'saveSelf']).as('self')
              router.post(':id/submit-self', [ReviewsController, 'submitSelf']).as('submitSelf')
              router.patch(':id/manager', [ReviewsController, 'saveManager']).as('manager')
              router.post(':id/validate', [ReviewsController, 'validate']).as('validate')
              router.post(':id/send-back', [ReviewsController, 'sendBack']).as('sendBack')
              router.post(':id/sign', [ReviewsController, 'sign']).as('sign')
            })
            .prefix('reviews')
            .as('reviews')

          router
            .group(() => {
              router.get('/', [FeedbackController, 'index']).as('index')
              router.post('/', [FeedbackController, 'store']).as('store')
              router.delete(':id', [FeedbackController, 'destroy']).as('destroy')
            })
            .prefix('feedback')
            .as('feedback')

          router
            .group(() => {
              router.get('/', [FeedbackController, 'achievements']).as('index')
              router.post('/', [FeedbackController, 'storeAchievement']).as('store')
              router.delete(':id', [FeedbackController, 'destroyAchievement']).as('destroy')
            })
            .prefix('achievements')
            .as('achievements')
        })
        .prefix('performance')
        .as('performance')
        .use(middleware.entitlement({ module: 'performance' }))

      router
        .group(() => {
          router.get('zones', [TimeclockSetupController, 'zones']).as('zones.index')
          router.post('zones', [TimeclockSetupController, 'storeZone']).as('zones.store')
          router.patch('zones/:id', [TimeclockSetupController, 'updateZone']).as('zones.update')
          router.delete('zones/:id', [TimeclockSetupController, 'destroyZone']).as('zones.destroy')
          router
            .post('punch', [TimeclockController, 'punch'])
            .as('punch')
            .use(middleware.idempotency())
          router.get('logs', [TimeclockController, 'logs']).as('logs.index')
          router.post('logs/export', [AttendanceController, 'export']).as('logs.export')
          router.get('attendance', [AttendanceController, 'index']).as('attendance.index')
          router.get('today', [AttendanceController, 'today']).as('today')
          router.patch('logs/:id', [TimeclockController, 'correct']).as('logs.update')
          router.delete('logs/:id', [TimeclockController, 'destroy']).as('logs.destroy')
          router.get('badge-events', [TimeclockSetupController, 'badgeEvents']).as('badgeEvents')
          router.get('device-tokens', [TimeclockSetupController, 'devices']).as('devices.index')
          router
            .post('device-tokens', [TimeclockSetupController, 'storeDevice'])
            .as('devices.store')
          router.get('device-tokens/:id', [TimeclockSetupController, 'device']).as('devices.show')
          router
            .delete('device-tokens/:id', [TimeclockSetupController, 'revokeDevice'])
            .as('devices.destroy')
        })
        .prefix('timeclock')
        .as('timeclock')
        .use(middleware.entitlement({ module: 'timeclock' }))

      router
        .group(() => {
          router.get(':id/badge', [TimeclockSetupController, 'badge']).as('show')
          router
            .post(':id/badge', [TimeclockSetupController, 'assignBadge'])
            .as('store')
            .use(middleware.idempotency())
          router.delete(':id/badge', [TimeclockSetupController, 'revokeBadge']).as('destroy')
        })
        .prefix('employees')
        .as('employees.badge')
        .use(middleware.entitlement({ module: 'timeclock' }))
    })
    .prefix('org')
    .as('org')
    .use([middleware.auth(), throttleUser, middleware.tenant()])

  // Badge readers: a member session or a kiosk token (05 §6), see TimeclockActorMiddleware.
  router
    .group(() => {
      router.post('scan', [TimeclockController, 'scan']).as('scan').use(middleware.idempotency())
      router.post('sync', [TimeclockController, 'sync']).as('sync')
    })
    .prefix('org/timeclock')
    .as('org.timeclock')
    .use([
      middleware.timeclockActor(),
      throttleUser,
      middleware.entitlement({ module: 'timeclock' }),
    ])
}
