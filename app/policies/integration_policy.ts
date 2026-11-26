import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Integrations (06 §8): social accounts are connected and removed by O H. */
@inject()
export default class IntegrationPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  manageSocialAccounts(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }
}
