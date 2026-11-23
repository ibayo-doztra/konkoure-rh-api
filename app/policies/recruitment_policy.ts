import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/**
 * Recruitment (docs/backend/04 §5 "Recrutement", 06 §8). `inDepartment`: the
 * offer belongs to the department of the viewing manager.
 */
@inject()
export default class RecruitmentPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  /** O H R, and managers for the offers of their department (scoped by the service). */
  listJobs(_user: User) {
    return this.isStaff() || this.ctx.tenant.hasRole('manager')
  }

  viewJob(_user: User, inDepartment: boolean) {
    return this.isStaff() || (inDepartment && this.ctx.tenant.hasRole('manager'))
  }

  /** Create, update, publish, close, duplicate, delete, QR: O H R. */
  manageJobs(_user: User) {
    return this.isStaff()
  }

  private isStaff() {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'recruiter')
  }
}
