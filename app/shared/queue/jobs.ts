import mail from '@adonisjs/mail/services/main'
import type { MailerMessenger } from '@adonisjs/mail/types'

export type QueueName = 'critical' | 'default' | 'ai' | 'outbound' | 'maintenance'

import type { ExportJob } from '#modules/hr/services/employee_export_service'

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
  { job: 'leaves.end', pattern: '10 0 * * *' },
  { job: 'leaves.annual-rollover', pattern: '30 0 1 1 *' },
  { job: 'contracts.expiring', pattern: '0 2 * * *' },
]

export const SCHEDULE_TIMEZONE = 'Africa/Conakry'

export type JobPayload<Name extends JobName> = Parameters<(typeof jobs)[Name]['handle']>[0]
