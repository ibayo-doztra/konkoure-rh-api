import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Talents module (docs/backend/04 §5 "talents (9box, succession)"). */
@inject()
export default class TalentPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  /** Skills matrix and 9-box: everyone for owner and hr_admin, the team for a manager. */
  view(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager')
  }

  /** Succession plans and matrix updates. */
  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }
}
