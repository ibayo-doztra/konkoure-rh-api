import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy, allowGuest } from '@adonisjs/bouncer'
import type User from '#models/user'

/** Timeclock (docs/backend/04 §5 "Pointage", 06 §6). Lists are scoped by the services. */
@inject()
export default class TimeclockPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  listZones(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager', 'security_agent')
  }

  manage(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  /** Badge readers: a kiosk token, or owner, hr_admin, manager, security_agent. */
  @allowGuest()
  scan(_user: User | null) {
    if (this.ctx.device) return true
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager', 'security_agent')
  }

  @allowGuest()
  sync(user: User | null) {
    return this.ctx.device !== undefined || user !== null
  }

  listLogs(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager', 'employee', 'security_agent')
  }

  /** Daily aggregates: everyone, scoped by the service (06 §6). */
  listAttendance(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager', 'employee', 'security_agent')
  }

  /** Present and absent today: managers see their team (lot 2 decision). */
  viewToday(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'manager', 'security_agent')
  }

  exportLogs(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  /** Assignment, revocation and masked reading of badges. */
  manageBadges(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'security_agent')
  }
}
