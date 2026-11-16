import type { HttpContext } from '@adonisjs/core/http'
import meService from '#modules/users/services/me_service'
import passwordService from '#modules/auth/services/password_service'
import {
  changePasswordValidator,
  sessionIdValidator,
  updateMeValidator,
} from '#modules/users/validators/me_validator'
import { meDto, organizationDto, sessionDto } from '#modules/users/transformers/me_transformer'
import { auditContext, currentFamilyId } from '#modules/auth/http_helpers'

/**
 * `/api/v1/me/*` (06-api-reference §2). Every action targets the authenticated
 * user only, so no other authorization than authentication applies.
 */
export default class MeController {
  async show(ctx: HttpContext) {
    return ctx.serialize(meDto(await meService.snapshot(ctx.auth.getUserOrFail())))
  }

  async update(ctx: HttpContext) {
    const changes = await ctx.request.validateUsing(updateMeValidator)
    const user = await meService.updateProfile(ctx.auth.getUserOrFail(), changes)
    return ctx.serialize(meDto(await meService.snapshot(user)))
  }

  async changePassword(ctx: HttpContext) {
    const { currentPassword, password } = await ctx.request.validateUsing(changePasswordValidator)
    await passwordService.change(
      ctx.auth.getUserOrFail(),
      currentPassword,
      password,
      currentFamilyId(ctx),
      auditContext(ctx)
    )
    return ctx.response.noContent()
  }

  async sessions(ctx: HttpContext) {
    const rows = await meService.sessions(ctx.auth.getUserOrFail())
    const current = currentFamilyId(ctx)
    // Plain array: `ctx.serialize` only wraps objects and transformer output.
    return { data: rows.map((row) => sessionDto(row, current)) }
  }

  async revokeSession(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(sessionIdValidator)
    await meService.revokeSession(ctx.auth.getUserOrFail(), params.id)
    return ctx.response.noContent()
  }

  async organizations(ctx: HttpContext) {
    const rows = await meService.organizations(ctx.auth.getUserOrFail())
    return { data: rows.map(organizationDto) }
  }
}
