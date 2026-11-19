import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { QueueName } from '#shared/queue/jobs'

/** Worker process, separate from HTTP and scaled on its own (docs/backend/08 §1). */
export default class QueueWork extends BaseCommand {
  static commandName = 'queue:work'
  static description = 'Process background jobs'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  @flags.array({ description: 'Queues to process (all by default)' })
  declare queues?: string[]

  async run() {
    const { default: queueService, QUEUES } = await import('#shared/queue/queue_service')
    const names = this.queues?.length ? this.queues : Object.keys(QUEUES)
    const unknown = names.filter((name) => !(name in QUEUES))
    if (unknown.length > 0) {
      this.logger.error(`Unknown queues: ${unknown.join(', ')}`)
      this.exitCode = 1
      await this.terminate()
      return
    }

    await queueService.registerSchedules()
    const workers = queueService.startWorkers(names as QueueName[])
    this.app.terminating(async () => {
      await Promise.all(workers.map((worker) => worker.close()))
    })
    this.app.listen('SIGTERM', () => this.app.terminate())
    this.app.listen('SIGINT', () => this.app.terminate())
    this.logger.info(`Processing queues: ${names.join(', ')}`)
  }
}
