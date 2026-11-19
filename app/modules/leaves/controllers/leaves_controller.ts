import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import LeavePolicy from '#policies/leave_policy'
import leaveService from '#modules/leaves/services/leave_service'
import { leaveDto, leaveViewDto } from '#modules/leaves/transformers/leave_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  createLeaveValidator,
  leaveIdValidator,
  listLeavesValidator,
  rejectLeaveValidator,
  updateLeaveValidator,
} from '#modules/leaves/validators/leave_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/leaves` (06-api-reference §7). */
export default class LeavesController {
  @ApiOperation({ summary: 'List the leaves visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listLeavesValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('list')
    const { rows, meta } = await leaveService.list(ctx.tenant, query)
    return { data: rows.map(leaveDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Leave detail, with the projected balance' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(leaveIdValidator)
    const { leave, inTeam } = await leaveService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(LeavePolicy).authorize('view', leave, inTeam)
    return ctx.serialize(leaveViewDto(await leaveService.view(ctx.tenant, leave)))
  }

  @ApiOperation({ summary: 'Request a leave (days computed by the server)' })
  @ApiBody({ type: () => createLeaveValidator })
  async store(ctx: HttpContext) {
    const { employeeId, ...input } = await ctx.request.validateUsing(createLeaveValidator)
    const target = employeeId ?? ctx.tenant.employeeId
    await ctx.bouncer.with(LeavePolicy).authorize('request', target)
    const view = await leaveService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      target!,
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(leaveViewDto(view))
  }

  @ApiOperation({ summary: 'Change a pending leave (author only)' })
  @ApiBody({ type: () => updateLeaveValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateLeaveValidator)
    const { leave } = await leaveService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(LeavePolicy).authorize('update', leave)
    const view = await leaveService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(leaveViewDto(view))
  }

  @ApiOperation({ summary: 'Approve a pending leave' })
  async approve(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(leaveIdValidator)
    const { leave, inTeam } = await leaveService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(LeavePolicy).authorize('decide', leave, inTeam)
    const view = await leaveService.approve(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(leaveViewDto(view))
  }

  @ApiOperation({ summary: 'Reject a pending leave (comment required)' })
  @ApiBody({ type: () => rejectLeaveValidator })
  async reject(ctx: HttpContext) {
    const { params, decisionComment } = await ctx.request.validateUsing(rejectLeaveValidator)
    const { leave, inTeam } = await leaveService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(LeavePolicy).authorize('decide', leave, inTeam)
    const view = await leaveService.reject(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      decisionComment,
      auditContext(ctx)
    )
    return ctx.serialize(leaveViewDto(view))
  }

  @ApiOperation({ summary: 'Cancel a pending leave, or an approved one before it starts' })
  async cancel(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(leaveIdValidator)
    const { leave, inTeam } = await leaveService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(LeavePolicy).authorize('cancel', leave, inTeam)
    const view = await leaveService.cancel(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(leaveViewDto(view))
  }
}
