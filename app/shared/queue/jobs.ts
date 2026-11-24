import mail from '@adonisjs/mail/services/main'
import type { MailerMessenger } from '@adonisjs/mail/types'

export type QueueName = 'critical' | 'default' | 'ai' | 'outbound' | 'maintenance'

import type { ExportJob } from '#modules/hr/services/employee_export_service'
import type { TimeLogExportJob } from '#modules/timeclock/services/time_log_export_service'

type CompiledMail = Parameters<MailerMessenger['queue']>[0]

export interface SendMailPayload {
  mail: CompiledMail
  sendConfig?: unknown
}

interface JobDefinition<Payload> {
  queue: QueueName
  /**
   * Payload holds single-use links: finished jobs are not kept in Redis, unlike
   * the default retention (docs/backend/08 §1).
   */
  sensitive?: boolean
  /** Own retry schedule, instead of the default 5 attempts with exponential backoff. */
  retry?: { attempts: number; delaysMs: number[] }
  handle(payload: Payload): Promise<unknown>
}

function defineJob<Payload>(definition: JobDefinition<Payload>) {
  return definition
}

/** Scheduled leave task; the service is loaded on use to keep this map light. */
const leaveTask = (task: 'apply-started' | 'end' | 'annual-rollover') =>
  defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#modules/leaves/services/leave_schedule_service')
      return service.run(task)
    },
  })

/** Attendance service, loaded on use. */
async function attendance() {
  const { default: service } = await import('#modules/timeclock/services/attendance_service')
  return service
}

/** Every background job. Handlers are idempotent or safe to retry (08 §1). */
export const jobs = {
  'mail.send': defineJob<SendMailPayload>({
    queue: 'default',
    sensitive: true,
    handle: ({ mail: message, sendConfig }) => mail.use().sendCompiled(message, sendConfig),
  }),
  'leaves.apply-started': leaveTask('apply-started'),
  'leaves.end': leaveTask('end'),
  'leaves.annual-rollover': leaveTask('annual-rollover'),
  'employees.export': defineJob<ExportJob>({
    queue: 'maintenance',
    handle: async (payload) => {
      const { default: service } = await import('#modules/hr/services/employee_export_service')
      return service.build(payload)
    },
  }),
  'time-logs.export': defineJob<TimeLogExportJob>({
    queue: 'maintenance',
    handle: async (payload) => {
      const { default: service } =
        await import('#modules/timeclock/services/time_log_export_service')
      return service.build(payload)
    },
  }),
  'notifications.purge': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } =
        await import('#modules/notifications/services/notification_service')
      return service.purge()
    },
  }),
  'partitions.ensure': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#shared/maintenance/partition_service')
      return service.ensure()
    },
  }),
  'attendance.recompute': defineJob<{ organizationId: string; employeeId: string; day: string }>({
    queue: 'default',
    handle: async (payload) => attendance().then((service) => service.runRecompute(payload)),
  }),
  'attendance.consolidate': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => attendance().then((service) => service.consolidate()),
  }),
  'attendance.close-day': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => attendance().then((service) => service.closeDay()),
  }),
  'goals.mark-late': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#modules/performance/services/goal_service')
      return service.markLate()
    },
  }),
  'okr.checkin-reminder': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#modules/performance/services/okr_service')
      return service.checkinReminders()
    },
  }),
  'reviews.reminders': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#modules/performance/services/review_service')
      return service.reminders()
    },
  }),
  'jobs.auto-close': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#modules/recruitment/services/job_service')
      return service.autoClose()
    },
  }),
  /** n8n scoring call (07 §4.4): 3 attempts, 30 s, 5 min, 30 min, no side effect after. */
  'candidates.score': defineJob<{ organizationId: string; candidateId: string }>({
    queue: 'ai',
    retry: { attempts: 3, delaysMs: [30_000, 5 * 60_000, 30 * 60_000] },
    handle: async (payload) => {
      const { default: service } = await import('#modules/recruitment/services/scoring_service')
      return service.run(payload)
    },
  }),
  'candidates.score-result': defineJob<{ receiptId: string }>({
    queue: 'default',
    handle: async (payload) => {
      const { default: service } = await import('#modules/recruitment/services/scoring_service')
      return service.processReceipt(payload)
    },
  }),
  'subscriptions.lifecycle': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } =
        await import('#modules/billing/services/subscription_lifecycle_service')
      return service.run()
    },
  }),
  'contracts.expiring': defineJob<Record<string, never>>({
    queue: 'maintenance',
    handle: async () => {
      const { default: service } = await import('#modules/hr/services/contract_expiry_service')
      return service.run()
    },
  }),
}

export type JobName = keyof typeof jobs

/**
 * Recurring jobs of docs/backend/08 §2, in Guinea local time. BullMQ job
 * schedulers enqueue each occurrence once, whatever the number of workers.
 */
export const SCHEDULES: ReadonlyArray<{ job: JobName; pattern: string }> = [
  { job: 'leaves.apply-started', pattern: '5 0 * * *' },
  { job: 'subscriptions.lifecycle', pattern: '0 1 * * *' },
  { job: 'leaves.end', pattern: '10 0 * * *' },
  { job: 'goals.mark-late', pattern: '20 0 * * *' },
  { job: 'jobs.auto-close', pattern: '30 0 * * *' },
  { job: 'okr.checkin-reminder', pattern: '0 9 25 * *' },
  { job: 'reviews.reminders', pattern: '0 8 * * 1' },
  { job: 'leaves.annual-rollover', pattern: '30 0 1 1 *' },
  { job: 'contracts.expiring', pattern: '0 2 * * *' },
  { job: 'notifications.purge', pattern: '0 3 * * *' },
  { job: 'partitions.ensure', pattern: '30 3 * * *' },
  { job: 'attendance.consolidate', pattern: '*/15 * * * *' },
  { job: 'attendance.close-day', pattern: '59 23 * * *' },
]

export const SCHEDULE_TIMEZONE = 'Africa/Conakry'

export type JobPayload<Name extends JobName> = Parameters<(typeof jobs)[Name]['handle']>[0]
