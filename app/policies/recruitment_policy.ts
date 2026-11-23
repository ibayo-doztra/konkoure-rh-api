import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type CandidateNote from '#models/candidate_note'

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

  /** Candidates, notes, pipeline, hiring: O H R (04 §5). */
  manageCandidates(_user: User) {
    return this.isStaff()
  }

  /** O H any note; a recruiter only their own (07 §4.7). */
  deleteNote(user: User, note: CandidateNote) {
    if (this.ctx.tenant.hasRole('owner', 'hr_admin')) return true
    return this.ctx.tenant.hasRole('recruiter') && note.authorId === user.id
  }

  private isStaff() {
    return this.ctx.tenant.hasRole('owner', 'hr_admin', 'recruiter')
  }
}
