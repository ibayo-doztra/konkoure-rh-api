import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PlatformPolicy from '#policies/platform_policy'
import settingsService from '#modules/platform/services/platform_settings_service'
import operationsService from '#modules/platform/services/platform_operations_service'
import demoRequestService from '#modules/platform/services/demo_request_service'
import {
  demoRequestDto,
  logRowDto,
  platformPaymentDto,
  platformSettingDto,
} from '#modules/platform/transformers/platform_transformer'
import {
  idValidator,
  listDemoRequestsValidator,
  listPlatformPaymentsValidator,
  logsValidator,
  updateDemoRequestValidator,
  updateSettingsValidator,
} from '#modules/platform/validators/platform_validator'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/platform` settings, payments, demo requests, journals and health (06 §13). */
export default class PlatformOperationsController {
  @ApiOperation({ summary: 'Platform settings (secret values hidden)' })
  async settings(ctx: HttpContext) {
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const settings = await settingsService.list()
    return { data: settings.map(platformSettingDto) }
  }

  @ApiOperation({ summary: 'Update platform settings (root)' })
  @ApiBody({ type: () => updateSettingsValidator })
  async updateSettings(ctx: HttpContext) {
    const { settings } = await ctx.request.validateUsing(updateSettingsValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const rows = await settingsService.update(ctx.auth.getUserOrFail(), settings, auditContext(ctx))
    return { data: rows.map(platformSettingDto) }
  }

  @ApiOperation({ summary: 'Payments across organizations' })
  async payments(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listPlatformPaymentsValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const page = await operationsService.payments({
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      ...query.filter,
    })
    return { data: page.all().map(platformPaymentDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Reconcile a payment with Djomy (root)' })
  async reconcile(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('root')
    const { payment, outcome } = await operationsService.reconcile(
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize({ outcome, payment: platformPaymentDto(payment) })
  }

  @ApiOperation({ summary: 'Demo requests' })
  async demoRequests(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listDemoRequestsValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const page = await demoRequestService.list({
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      status: query.filter?.status,
    })
    return { data: page.all().map(demoRequestDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Change the status or assignee of a demo request' })
  @ApiBody({ type: () => updateDemoRequestValidator })
  async updateDemoRequest(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateDemoRequestValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const request = await demoRequestService.update(
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(demoRequestDto(request))
  }

  @ApiOperation({ summary: 'Audit, system or usage journal (cursor, 500 at most)' })
  async logs(ctx: HttpContext) {
    const { params, ...query } = await ctx.request.validateUsing(logsValidator)
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    const { rows, nextCursor } = await operationsService.logs(params.kind, {
      cursor: query.cursor,
      limit: query.limit,
      ...query.filter,
    })
    return { data: rows.map(logRowDto), meta: { nextCursor } }
  }

  @ApiOperation({ summary: 'Database, Redis, migrations, queue and integrations' })
  async health(ctx: HttpContext) {
    await ctx.bouncer.with(PlatformPolicy).authorize('support')
    return ctx.serialize(await operationsService.health())
  }
}
