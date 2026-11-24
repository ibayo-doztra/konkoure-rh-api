import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Organization billing: owners only (docs/backend/04 §5 "billing.*"). */
@inject()
export default class BillingPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner')
  }
}
