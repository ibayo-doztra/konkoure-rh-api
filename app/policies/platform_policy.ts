import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Back office (docs/backend/04 §5 "Back-office plateforme"): support reads, root writes. */
@inject()
export default class PlatformPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  /** Reading the back office: every active admin (the `platform` middleware checked it). */
  support(_user: User) {
    return Boolean(this.ctx.platformAdmin)
  }

  /** Plans, subscriptions, roles, settings, admins, destructive actions. */
  root(_user: User) {
    return this.ctx.platformAdmin?.level === 'root'
  }
}
