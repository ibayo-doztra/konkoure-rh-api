import mail from '@adonisjs/mail/services/main'
import type { MailerMessenger } from '@adonisjs/mail/types'

export type QueueName = 'critical' | 'default' | 'ai' | 'outbound' | 'maintenance'

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

/** Every background job. Handlers are idempotent or safe to retry (08 §1). */
export const jobs = {
  'mail.send': defineJob<SendMailPayload>({
    queue: 'default',
    sensitive: true,
    handle: ({ mail: message, sendConfig }) => mail.use().sendCompiled(message, sendConfig),
  }),
}

export type JobName = keyof typeof jobs
export type JobPayload<Name extends JobName> = Parameters<(typeof jobs)[Name]['handle']>[0]
