import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Employee from '#models/employee'

/** Competencies (docs/backend/04 §5, 06 §5). */
@inject()
export default class SkillPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  viewCatalog(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager')
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  viewOfEmployee(_user: User, employee: Employee, inTeam: boolean) {
    const { tenant } = this.ctx
    if (tenant.hasRole('owner', 'hr_admin') || tenant.employeeId === employee.id) return true
    return inTeam && tenant.hasRole('manager')
  }
}
