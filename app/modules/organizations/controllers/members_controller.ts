import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import OrganizationPolicy from '#policies/organization_policy'
import memberService from '#modules/organizations/services/member_service'
import { memberDto } from '#modules/organizations/transformers/organization_transformer'
import {
  listMembersValidator,
  memberIdValidator,
  updateMemberRolesValidator,
} from '#modules/organizations/validators/member_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/members` (06-api-reference §3), owner and hr_admin only. */
export default class MembersController {
  @ApiOperation({ summary: 'List members and their roles (?page, ?perPage)' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listMembersValidator, {
      data: ctx.request.qs(),
    })
    await ctx.bouncer.with(OrganizationPolicy).authorize('manageMembers')
    const { rows, meta } = await memberService.list(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    })
    return {
      data: rows.map(memberDto),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  @ApiOperation({ summary: 'Replace the roles of a member' })
  @ApiBody({ type: () => updateMemberRolesValidator })
  async updateRoles(ctx: HttpContext) {
    const { params, roles } = await ctx.request.validateUsing(updateMemberRolesValidator)
    await ctx.bouncer.with(OrganizationPolicy).authorize('manageMembers')
    const member = await memberService.find(ctx.tenant, params.userId)
    await ctx.bouncer.with(OrganizationPolicy).authorize('updateMemberRoles', member, roles)
    const updated = await memberService.updateRoles(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.userId,
      roles,
      auditContext(ctx)
    )
    return ctx.serialize(memberDto(updated))
  }

  @ApiOperation({ summary: 'Remove a member from the organization' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(memberIdValidator)
    await ctx.bouncer.with(OrganizationPolicy).authorize('manageMembers')
    const member = await memberService.find(ctx.tenant, params.userId)
    await ctx.bouncer.with(OrganizationPolicy).authorize('removeMember', member)
    await memberService.remove(ctx.tenant, params.userId, auditContext(ctx))
    return ctx.response.noContent()
  }
}
