import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Makes an existing account a platform admin, or revokes it (decisions of
 * 2026-11-25 and 2026-11-27).
 *
 * Outside production (end-to-end tests, local support):
 *   node ace platform:grant admin@konkoure.test root
 *   node ace platform:grant admin@konkoure.test --revoke
 *
 * In production, only the first root (no active root yet, active account with
 * a verified e-mail), after confirmation (`--force` skips it):
 *   node ace platform:grant founder@example.com root
 */
export default class PlatformGrant extends BaseCommand {
  static commandName = 'platform:grant'
  static description =
    'Grant or revoke the platform admin level of an account (production: first root only)'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'E-mail of an existing account' })
  declare email: string

  @args.string({ description: 'Level: support or root', required: false })
  declare level?: string

  @flags.boolean({ description: 'Revoke the platform access instead (not in production)' })
  declare revoke: boolean

  @flags.boolean({ description: 'Skip the production confirmation' })
  declare force: boolean

  async run() {
    const { default: service } = await import('#modules/platform/services/platform_grant_service')
    try {
      if (this.revoke) {
        const revoked = await service.revoke(this.email)
        this.logger.success(
          revoked ? `${this.email} is no longer a platform admin` : `${this.email} was not an admin`
        )
        return
      }
      if (!this.level) throw new Error('Missing level: support or root (or --revoke)')
      if (this.app.inProduction && !this.force) {
        const confirmed = await this.prompt.confirm(
          `Make ${this.email} the first platform root admin in PRODUCTION?`
        )
        if (!confirmed) {
          this.logger.info('Cancelled')
          return
        }
      }
      await service.grant(this.email, this.level)
      this.logger.success(`${this.email} is now platform ${this.level}`)
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error))
      this.exitCode = 1
    }
  }
}
