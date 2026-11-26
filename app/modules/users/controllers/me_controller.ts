import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import meService from '#modules/users/services/me_service'
import accountDeletionService from '#modules/users/services/account_deletion_service'
import passwordService from '#modules/auth/services/password_service'
import {
  changePasswordValidator,
  deleteMeValidator,
  sessionIdValidator,
  updateMeValidator,
} from '#modules/users/validators/me_validator'
import { meDto, organizationDto, sessionDto } from '#modules/users/transformers/me_transformer'
import { auditContext, currentFamilyId } from '#modules/auth/http_helpers'
import { impersonationOf } from '#modules/auth/impersonation'
import { confirmedBody } from '#shared/utils/openapi'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Optional on `GET /me`: an invalid or stale value simply selects nothing. */
function selectedOrganization(ctx: HttpContext) {
  const id = ctx.request.header('x-organization-id')?.trim()
  return id && UUID.test(id) ? id : null
}

/**
 * `/api/v1/me/*` (06-api-reference §2). Every action targets the authenticated
 * user only, so no other authorization than authentication applies.
 */
export default class MeController {
  @ApiOperation({ summary: 'Current user, memberships and roles' })
  async show(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const snapshot = await meService.snapshot(user, selectedOrganization(ctx))
    return ctx.serialize(meDto({ ...snapshot, impersonation: impersonationOf(user) }))
  }

  @ApiOperation({ summary: 'Update the profile' })
  @ApiBody({ type: () => updateMeValidator })
  async update(ctx: HttpContext) {
    const changes = await ctx.request.validateUsing(updateMeValidator)
    const user = await meService.updateProfile(ctx.auth.getUserOrFail(), changes)
    return ctx.serialize(meDto(await meService.snapshot(user)))
  }

  @ApiOperation({ summary: 'Change the password' })
  @ApiBody({ schema: confirmedBody(changePasswordValidator) })
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

  @ApiOperation({ summary: 'List active sessions' })
  async sessions(ctx: HttpContext) {
    const rows = await meService.sessions(ctx.auth.getUserOrFail())
    const current = currentFamilyId(ctx)
    // Plain array: `ctx.serialize` only wraps objects and transformer output.
    return { data: rows.map((row) => sessionDto(row, current)) }
  }

  @ApiOperation({ summary: 'Revoke a session' })
  async revokeSession(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(sessionIdValidator)
    await meService.revokeSession(ctx.auth.getUserOrFail(), params.id)
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'List my organizations' })
  async organizations(ctx: HttpContext) {
    const rows = await meService.organizations(ctx.auth.getUserOrFail())
    return { data: rows.map(organizationDto) }
  }

  @ApiOperation({ summary: 'Delete my account (GDPR anonymization)' })
  @ApiBody({ type: () => deleteMeValidator })
  async destroy(ctx: HttpContext) {
    const { password } = await ctx.request.validateUsing(deleteMeValidator)
    await accountDeletionService.delete(ctx.auth.getUserOrFail(), password, auditContext(ctx))
    return ctx.response.noContent()
  }
}
