import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import TimeclockPolicy from '#policies/timeclock_policy'
import punchService, { type PunchActor } from '#modules/timeclock/services/punch_service'
import timeLogService from '#modules/timeclock/services/time_log_service'
import { punchDto, timeLogDto } from '#modules/timeclock/transformers/timeclock_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  correctLogValidator,
  idValidator,
  listLogsValidator,
  punchValidator,
  scanValidator,
  syncValidator,
} from '#modules/timeclock/validators/timeclock_validator'
import { auditContext } from '#modules/auth/http_helpers'

const actorOf = (ctx: HttpContext): PunchActor =>
  ctx.device
    ? { kind: 'device', deviceTokenId: ctx.device.id }
    : { kind: 'user', user: ctx.auth.getUserOrFail() }

/** `/api/v1/org/timeclock` punches and history (06-api-reference §6). */
export default class TimeclockController {
  @ApiOperation({ summary: 'Badge scan (member session or kiosk token)' })
  @ApiBody({ type: () => scanValidator })
  async scan(ctx: HttpContext) {
    const { badgeUid, ...input } = await ctx.request.validateUsing(scanValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('scan')
    const result = await punchService.scan(
      ctx.tenant,
      actorOf(ctx),
      badgeUid,
      input,
      ctx.request.ip()
    )
    ctx.response.status(result.replayed ? 200 : 201)
    return ctx.serialize(punchDto(result))
  }

  @ApiOperation({ summary: 'Punch for oneself (manual or GPS)' })
  @ApiBody({ type: () => punchValidator })
  async punch(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(punchValidator)
    const result = await punchService.self(ctx.tenant, ctx.auth.getUserOrFail(), input)
    ctx.response.status(result.replayed ? 200 : 201)
    return ctx.serialize(punchDto(result))
  }

  @ApiOperation({ summary: 'Offline batch of 1 to 200 punches' })
  @ApiBody({ type: () => syncValidator })
  async sync(ctx: HttpContext) {
    const { punches } = await ctx.request.validateUsing(syncValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('sync')
    const canScan = await ctx.bouncer.with(TimeclockPolicy).allows('scan')
    const results = await punchService.sync(
      ctx.tenant,
      actorOf(ctx),
      punches,
      canScan,
      ctx.request.ip()
    )
    return { data: results }
  }

  @ApiOperation({ summary: 'Punch history visible to the caller' })
  async logs(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listLogsValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('listLogs')
    const { rows, meta } = await timeLogService.list(ctx.tenant, query)
    return { data: rows.map(timeLogDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Correct a punch (audited)' })
  @ApiBody({ type: () => correctLogValidator })
  async correct(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(correctLogValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const log = await timeLogService.correct(ctx.tenant, params.id, input, auditContext(ctx))
    return ctx.serialize(timeLogDto(log))
  }

  @ApiOperation({ summary: 'Delete a punch (audited)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    await timeLogService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
