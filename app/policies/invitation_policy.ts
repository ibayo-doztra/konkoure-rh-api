import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type { AppRole } from '#models/user_role'

/**
 * `invitations.*` is reserved to owner and hr_admin; only an owner may hand
 * out the owner role (docs/backend/04 §5, like `users.roles.update`).
 */
@inject()
export default class InvitationPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  invite(_user: User, role: AppRole) {
    if (!this.ctx.tenant.hasRole('owner', 'hr_admin')) return false
    return role !== 'owner' || this.ctx.tenant.hasRole('owner')
  }
}
