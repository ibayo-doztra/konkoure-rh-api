import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Dashboard (06 §3): every member; the service narrows the figures to their scope. */
@inject()
export default class DashboardPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  view(_user: User) {
    return this.ctx.tenant.roles.length > 0
  }
}
