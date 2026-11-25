import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PlatformPolicy from '#policies/platform_policy'
import userService from '#modules/platform/services/platform_user_service'
import adminService from '#modules/platform/services/platform_admin_service'
import {
  platformAdminDto,
  platformUserDto,
} from '#modules/platform/transformers/platform_transformer'
import {
  adminUserIdValidator,
  grantAdminValidator,
  idValidator,
  listUsersValidator,
  reasonValidator,
  updateUserRolesValidator,
} from '#modules/platform/validators/platform_validator'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/platform/users` and `/platform/admins` (06 §13, decisions of 2026-11-24). */
export default class PlatformUsersController {
  @ApiOperation({ summary: 'Search accounts across the platform' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listUsersValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const { page, memberships, levels } = await userService.search({
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      q: query.q,
    })
    return {
      data: page
        .all()
        .map((user) =>
          platformUserDto(user, memberships.get(user.id) ?? [], levels.get(user.id) ?? null)
        ),
      meta: pageMetaDto(page.getMeta()),
    }
  }

  @ApiOperation({ summary: 'Replace the roles of an account in an organization (root)' })
  @ApiBody({ type: () => updateUserRolesValidator })
  async updateRoles(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateUserRolesValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const roles = await userService.updateRoles(
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize({ organizationId: input.organizationId, roles })
  }

  @ApiOperation({ summary: 'Ban an account: deactivated, every session revoked (root)' })
  @ApiBody({ type: () => reasonValidator })
  async ban(ctx: HttpContext) {
    const { params, reason } = await ctx.request.validateUsing(reasonValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const user = await userService.ban(
      ctx.auth.getUserOrFail(),
      params.id,
      reason,
      auditContext(ctx)
    )
    return ctx.serialize(platformUserDto(user))
  }

  @ApiOperation({ summary: 'Lift the ban of an account (root)' })
  async unban(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const user = await userService.unban(ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.serialize(platformUserDto(user))
  }

  @ApiOperation({ summary: 'Act as an account for 30 minutes (root, audited)' })
  @ApiBody({ type: () => reasonValidator })
  async impersonate(ctx: HttpContext) {
    const { params, reason } = await ctx.request.validateUsing(reasonValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const result = await userService.impersonate(
      ctx.auth.getUserOrFail(),
      params.id,
      reason,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      expiresAt: result.expiresAt.toUTC().toISO(),
      user: platformUserDto(result.user),
    })
  }

  @ApiOperation({ summary: 'Active platform admins (root)' })
  async admins(ctx: HttpContext) {
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const rows = await adminService.list()
    return { data: rows.map(({ admin, user }) => platformAdminDto(admin, user)) }
  }

  @ApiOperation({ summary: 'Grant or change the platform level of an account (root)' })
  @ApiBody({ type: () => grantAdminValidator })
  async grantAdmin(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(grantAdminValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const { admin, user } = await adminService.grant(
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(platformAdminDto(admin, user))
  }

  @ApiOperation({ summary: 'Remove the platform access of an account (root)' })
  async revokeAdmin(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(adminUserIdValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    await adminService.revoke(ctx.auth.getUserOrFail(), params.userId, auditContext(ctx))
    return ctx.response.noContent()
  }
}
