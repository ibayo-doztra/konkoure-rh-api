import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Grants a plan to an organization (decision of 2026-11-23): end-to-end tests
 * and local support until the platform back office. Refused in production.
 *
 *   node ace subscription:grant <organizationId> pro --days=30
 */
export default class SubscriptionGrant extends BaseCommand {
  static commandName = 'subscription:grant'
  static description = 'Give an organization an active subscription on a plan (not in production)'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Organization id (uuid)' })
  declare organizationId: string

  @args.string({ description: 'Plan code: free, starter, pro or enterprise' })
  declare planCode: string

  @flags.number({ description: 'Length of the period in days', default: 30 })
  declare days: number

  async run() {
    const { default: service } =
      await import('#modules/billing/services/subscription_grant_service')
    try {
      const subscription = await service.grant(this.organizationId, this.planCode, this.days)
      this.logger.success(
        `${this.planCode} granted to ${this.organizationId} until ${subscription.currentPeriodEnd.toISO()}`
      )
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error))
      this.exitCode = 1
    }
  }
}
