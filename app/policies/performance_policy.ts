import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Goal from '#models/goal'
import type Okr from '#models/okr'
import type PerformanceReview from '#models/performance_review'
import type Feedback from '#models/feedback'
import type Achievement from '#models/achievement'

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

  /** `POST /okrs/suggest` (06 §9 "self"): any member with an employee record. */
  suggestOkr(_user: User) {
    return this.ctx.tenant.employeeId !== null
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

  /** `POST /reviews`: opening a cycle's evaluations is HR's (06 §9). */
  openReviews(_user: User) {
    return this.isHr()
  }

  viewReview(_user: User, review: PerformanceReview, inTeam: boolean) {
    return this.isHr() || this.isSelf(review) || this.isTeamManager(inTeam)
  }

  /** Self-evaluation, its submission and the signature: the evaluated employee only. */
  selfReview(_user: User, review: PerformanceReview) {
    return this.isSelf(review)
  }

  /** Manager side, validation and send-back: O H or the manager, never on one's own. */
  manageReview(_user: User, review: PerformanceReview, inTeam: boolean) {
    if (this.isSelf(review)) return false
    return this.isHr() || this.isTeamManager(inTeam)
  }

  /** 9-box scores of an evaluation (decision of 2026-11-24): HR only, never on one's own. */
  scoreTalent(_user: User, review: PerformanceReview) {
    return this.isHr() && !this.isSelf(review)
  }

  /** The author or O H, never the recipient (04 §5, 07 §5.9). */
  deleteFeedback(user: User, feedback: Feedback) {
    const self = this.ctx.tenant.employeeId
    if (self !== null && feedback.toEmployeeId === self) return false
    if (this.isHr()) return true
    return feedback.createdBy === user.id || (self !== null && feedback.fromEmployeeId === self)
  }

  /** Achievements: self · M(team) · O H (06 §9). */
  createAchievement(_user: User, employeeId: string, inTeam: boolean) {
    return this.isHr() || this.ctx.tenant.employeeId === employeeId || this.isTeamManager(inTeam)
  }

  /** The author or O H (06 §9, added 2026-11-20). */
  deleteAchievement(user: User, achievement: Achievement) {
    return this.isHr() || achievement.createdBy === user.id
  }

  private isHr() {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  private isSelf(record: { employeeId: string | null }) {
    return record.employeeId !== null && this.ctx.tenant.employeeId === record.employeeId
  }

  private isTeamManager(inTeam: boolean) {
    return inTeam && this.ctx.tenant.hasRole('manager')
  }
}
