import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type { AppRole } from '#models/user_role'
import type { MemberRow } from '#modules/organizations/repositories/member_repository'

/** Settings and members of the current organization (docs/backend/04 §5). */
@inject()
export default class OrganizationPolicy extends BasePolicy {
  constructor(protected ctx: HttpContext) {
    super()
  }

  update(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  delete(_user: User) {
    return this.ctx.tenant.hasRole('owner')
  }

  manageMembers(_user: User) {
    return this.ctx.tenant.hasRole('owner', 'hr_admin')
  }

  /** Nobody changes their own roles; only an owner touches an owner or the owner role. */
  updateMemberRoles(user: User, member: MemberRow, roles: AppRole[]) {
    if (!this.ctx.tenant.hasRole('owner', 'hr_admin') || user.id === member.userId) return false
    return this.ctx.tenant.hasRole('owner') || ![...member.roles, ...roles].includes('owner')
  }

  removeMember(_user: User, member: MemberRow) {
    if (!this.ctx.tenant.hasRole('owner', 'hr_admin')) return false
    return this.ctx.tenant.hasRole('owner') || !member.roles.includes('owner')
  }
}
