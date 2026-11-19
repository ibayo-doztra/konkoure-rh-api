import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Runs a scheduled job now, in this process (docs/backend/08 §2): development
 * without a worker, or catching up after an incident. Scheduled jobs are idempotent.
 */
export default class ScheduleRun extends BaseCommand {
  static commandName = 'schedule:run'
  static description = 'Run a scheduled job now (see SCHEDULES in app/shared/queue/jobs.ts)'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Scheduled job, e.g. leaves.end or contracts.expiring' })
  declare job: string

  async run() {
    const { jobs, SCHEDULES } = await import('#shared/queue/jobs')
    const scheduled = SCHEDULES.find((entry) => entry.job === this.job)
    if (!scheduled) {
      const names = SCHEDULES.map((entry) => entry.job).join(', ')
      this.logger.error(`Unknown scheduled job "${this.job}". Expected: ${names}`)
      this.exitCode = 1
      return
    }
    const handle = jobs[scheduled.job].handle as (
      payload: Record<string, never>
    ) => Promise<unknown>
    const result = await handle({})
    this.logger.success(`${scheduled.job}: ${String(result)}`)
  }
}
