import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Employee from '#models/employee'
import { employeeVisibility } from '#modules/hr/employee_visibility'

/** Employee records (docs/backend/04 §5, 06 §4). */
@inject()
export default class EmployeePolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  view(_user: User, employee: Employee, inTeam: boolean) {
    return employeeVisibility(this.ctx.tenant, employee, inTeam) !== null
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  viewSalary(_user: User, employee: Employee) {
    return (
      this.ctx.tenant.hasRole('owner', 'hr_admin') || this.ctx.tenant.employeeId === employee.id
    )
  }

  viewTeam(_user: User, employee: Employee, inTeam: boolean) {
    const { tenant } = this
    if (tenant.hasRole('owner', 'hr_admin')) return true
    return tenant.hasRole('manager') && (inTeam || tenant.employeeId === employee.id)
  }

  listManagers(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager')
  }

  private get tenant() {
    return this.ctx.tenant
  }
}
