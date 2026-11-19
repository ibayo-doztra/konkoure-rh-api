import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Contract from '#models/contract'

/** Contracts (docs/backend/04 §5, 06 §5). The list is scoped by the service. */
@inject()
export default class ContractPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  list(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager', 'employee')
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  viewDocument(_user: User, contract: Contract) {
    const { tenant } = this.ctx
    return tenant.hasRole('owner', 'hr_admin') || tenant.employeeId === contract.employeeId
  }
}
