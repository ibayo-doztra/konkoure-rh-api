import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

const TASKS = ['apply-started', 'end', 'annual-rollover'] as const

/**
 * Runs a scheduled leave task now (docs/backend/08 §2): development without a
 * worker, or catching up after an incident. Tasks are idempotent.
 */
export default class LeavesRun extends BaseCommand {
  static commandName = 'leaves:run'
  static description = `Run a scheduled leave task now (${TASKS.join(', ')})`
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Task to run' })
  declare task: string

  async run() {
    const task = TASKS.find((name) => name === this.task)
    if (!task) {
      this.logger.error(`Unknown task "${this.task}". Expected: ${TASKS.join(', ')}`)
      this.exitCode = 1
      return
    }
    const { default: service } = await import('#modules/leaves/services/leave_schedule_service')
    const changed = await service.run(task)
    this.logger.success(`leaves:${task}: ${changed} change(s)`)
  }
}
