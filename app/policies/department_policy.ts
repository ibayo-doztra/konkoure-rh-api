import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Departments: readable by every member, written by HR (docs/backend/04 §5). */
@inject()
export default class DepartmentPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  listEmployees(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager')
  }
}
