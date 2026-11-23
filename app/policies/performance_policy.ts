import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Goal from '#models/goal'
import type Okr from '#models/okr'

/**
 * Performance (docs/backend/04 §5 "Performance", 06 §9). `inTeam`: the record
 * belongs to a direct or indirect report of the viewer. Lists are scoped by
 * the services.
 */
@inject()
export default class PerformancePolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  /** Cycles and plans: everyone reads, owner and hr_admin write. */
  read(_user: User) {
    return true
  }

  manageSetup(_user: User) {
    return this.isHr()
  }

  /**
   * Everyone creates for themselves; another holder or a declared owner is
   * reserved to owner, hr_admin and the manager of the holder (04, 07 §5.2).
   */
  createGoal(_user: User, employeeId: string, inTeam: boolean, withOwner: boolean) {
    if (this.isHr()) return true
    const forSelf = this.ctx.tenant.employeeId === employeeId
    if (forSelf && !withOwner) return true
    if (!this.ctx.tenant.hasRole('manager')) return false
    return forSelf || inTeam
  }

  viewGoal(_user: User, goal: Goal, inTeam: boolean) {
    return this.isHr() || this.isSelf(goal) || this.isTeamManager(inTeam)
  }

  /** Same as reading, but the declared owner is not the holder's to choose. */
  updateGoal(_user: User, goal: Goal, inTeam: boolean, withOwner: boolean) {
    if (this.isHr() || this.isTeamManager(inTeam)) return true
    return this.isSelf(goal) && !withOwner
  }

  /** `PATCH /goals/:id/progress`: the holder or their manager (06 §9). */
  progressGoal(_user: User, goal: Goal, inTeam: boolean) {
    return this.isSelf(goal) || this.isTeamManager(inTeam)
  }

  /** OKRs: everyone for themselves, O H for anyone, a manager for the team (06 §9). */
  createOkr(_user: User, employeeId: string, inTeam: boolean) {
    return this.isHr() || this.ctx.tenant.employeeId === employeeId || this.isTeamManager(inTeam)
  }

  viewOkr(_user: User, okr: Okr, inTeam: boolean) {
    return this.isHr() || this.isSelf(okr) || this.isTeamManager(inTeam)
  }

  /** Objective, quarter and deletion: the holder (state checked by the service) or O H. */
  editOkr(_user: User, okr: Okr) {
    return this.isHr() || this.isSelf(okr)
  }

  /** `PUT /okrs/:id/key-results`: self · O H · M(team). */
  editKeyResults(_user: User, okr: Okr, inTeam: boolean) {
    return this.isHr() || this.isSelf(okr) || this.isTeamManager(inTeam)
  }

  /** `PATCH /okrs/:id/key-results/:krId`: self · M(team). */
  progressKeyResult(_user: User, okr: Okr, inTeam: boolean) {
    return this.isSelf(okr) || this.isTeamManager(inTeam)
  }

  submitOkr(_user: User, okr: Okr) {
    return this.isSelf(okr)
  }

  /** Validate or send back: O H or the manager, never on one's own OKR. */
  decideOkr(_user: User, okr: Okr, inTeam: boolean) {
    if (this.isSelf(okr)) return false
    return this.isHr() || this.isTeamManager(inTeam)
  }

  private isHr() {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  private isSelf(record: Goal | Okr) {
    return record.employeeId !== null && this.ctx.tenant.employeeId === record.employeeId
  }

  private isTeamManager(inTeam: boolean) {
    return inTeam && this.ctx.tenant.hasRole('manager')
  }
}
