import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type LeaveRequest from '#models/leave_request'

/**
 * Leaves (docs/backend/04 §5 "Congés", 06 §7). `inTeam`: the leave belongs to
 * a direct or indirect report of the viewer. Lists are scoped by the service.
 */
@inject()
export default class LeavePolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  /** Everyone for themselves; owner and hr_admin also for any employee. */
  request(_user: User, employeeId: string | null) {
    const { tenant } = this.ctx
    if (employeeId === null) return false
    return tenant.hasRole('owner', 'hr_admin') || tenant.employeeId === employeeId
  }

  list(_user: User) {
    return true
  }

  view(_user: User, leave: LeaveRequest, inTeam: boolean) {
    return this.isHr() || this.isSelf(leave) || this.isTeamManager(inTeam)
  }

  /** The author while pending; the state itself is checked by the service. */
  update(user: User, leave: LeaveRequest) {
    return this.isSelf(leave) || leave.createdBy === user.id
  }

  /** Never one's own leave, whatever the role (07 §3.7). */
  decide(_user: User, leave: LeaveRequest, inTeam: boolean) {
    if (this.isSelf(leave)) return false
    return this.isHr() || this.isTeamManager(inTeam)
  }

  /** Pending: author, team manager, O/H. Approved: O/H only (07 §3.5). */
  cancel(user: User, leave: LeaveRequest, inTeam: boolean) {
    if (this.isHr()) return true
    if (leave.status !== 'pending') return false
    return this.isSelf(leave) || leave.createdBy === user.id || this.isTeamManager(inTeam)
  }

  /** Balance of one employee: self, team manager, O/H (06 "Endpoints complémentaires"). */
  viewBalanceOf(_user: User, employeeId: string, inTeam: boolean) {
    return this.isHr() || this.ctx.tenant.employeeId === employeeId || this.isTeamManager(inTeam)
  }

  /** Attachment: the author while pending, O/H at any time. */
  attach(user: User, leave: LeaveRequest) {
    if (this.isHr()) return true
    return leave.status === 'pending' && (this.isSelf(leave) || leave.createdBy === user.id)
  }

  adjustBalance(_user: User) {
    return this.isHr()
  }

  manageHolidays(_user: User) {
    return this.isHr()
  }

  private isHr() {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  private isSelf(leave: LeaveRequest) {
    return this.ctx.tenant.employeeId === leave.employeeId
  }

  private isTeamManager(inTeam: boolean) {
    return inTeam && this.ctx.tenant.hasRole('manager')
  }
}
