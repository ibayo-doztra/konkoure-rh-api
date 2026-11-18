import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import InvitationPolicy from '#policies/invitation_policy'
import invitationService from '#modules/invitations/services/invitation_service'
import { invitationDto } from '#modules/invitations/transformers/invitation_transformer'
import {
  createInvitationValidator,
  invitationIdValidator,
  listInvitationsValidator,
} from '#modules/invitations/validators/invitation_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/invitations` (06-api-reference §3), owner and hr_admin only. */
export default class InvitationsController {
  @ApiOperation({ summary: 'List invitations (?page, ?perPage, ?filter[status])' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listInvitationsValidator, {
      data: ctx.request.qs(),
    })
    await ctx.bouncer.with(InvitationPolicy).authorize('manage')
    const page = await invitationService.list(ctx.tenant, {
      status: query.filter?.status,
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    })
    const meta = page.getMeta()
    return {
      data: page.all().map(invitationDto),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  @ApiOperation({ summary: 'Invite an e-mail with a role (Idempotency-Key accepted)' })
  @ApiBody({ type: () => createInvitationValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createInvitationValidator)
    await ctx.bouncer.with(InvitationPolicy).authorize('invite', input.role)
    const invitation = await invitationService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(invitationDto(invitation))
  }

  @ApiOperation({ summary: 'Resend an invitation with a new link (3 per 24 h)' })
  async resend(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(invitationIdValidator)
    await ctx.bouncer.with(InvitationPolicy).authorize('manage')
    const invitation = await invitationService.resend(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(invitationDto(invitation))
  }

  @ApiOperation({ summary: 'Revoke a pending invitation' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(invitationIdValidator)
    await ctx.bouncer.with(InvitationPolicy).authorize('manage')
    await invitationService.revoke(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
