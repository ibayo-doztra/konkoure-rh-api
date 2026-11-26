import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import TimeclockPolicy from '#policies/timeclock_policy'
import badgeService from '#modules/timeclock/services/badge_service'
import deviceTokenService from '#modules/timeclock/services/device_token_service'
import zoneService from '#modules/timeclock/services/zone_service'
import workScheduleService from '#modules/timeclock/services/work_schedule_service'
import {
  badgeDto,
  badgeEventDto,
  deviceTokenDto,
  workScheduleDto,
  zoneDto,
} from '#modules/timeclock/transformers/timeclock_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  assignBadgeValidator,
  badgeEventsValidator,
  createDeviceTokenValidator,
  createScheduleValidator,
  createZoneValidator,
  idValidator,
  updateScheduleValidator,
  updateZoneValidator,
} from '#modules/timeclock/validators/timeclock_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** Zones, work schedules, badges and kiosk tokens (06-api-reference §6). */
export default class TimeclockSetupController {
  @ApiOperation({ summary: 'Work zones' })
  async zones(ctx: HttpContext) {
    await ctx.bouncer.with(TimeclockPolicy).authorize('listZones')
    const zones = await zoneService.list(ctx.tenant)
    return { data: zones.map(zoneDto) }
  }

  @ApiOperation({ summary: 'Create a work zone (circle or polygon)' })
  @ApiBody({ type: () => createZoneValidator })
  async storeZone(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createZoneValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const zone = await zoneService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(zoneDto(zone))
  }

  @ApiOperation({ summary: 'Change a work zone' })
  @ApiBody({ type: () => updateZoneValidator })
  async updateZone(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateZoneValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const zone = await zoneService.update(ctx.tenant, params.id, input, auditContext(ctx))
    return ctx.serialize(zoneDto(zone))
  }

  @ApiOperation({ summary: 'Delete a work zone' })
  async destroyZone(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    await zoneService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Work schedules' })
  async schedules(ctx: HttpContext) {
    await ctx.bouncer.with(TimeclockPolicy).authorize('listSchedules')
    const schedules = await workScheduleService.list(ctx.tenant)
    return { data: schedules.map(workScheduleDto) }
  }

  @ApiOperation({ summary: 'Create a work schedule' })
  @ApiBody({ type: () => createScheduleValidator })
  async storeSchedule(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createScheduleValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const schedule = await workScheduleService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(workScheduleDto(schedule))
  }

  @ApiOperation({ summary: 'Change a work schedule' })
  @ApiBody({ type: () => updateScheduleValidator })
  async updateSchedule(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateScheduleValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const schedule = await workScheduleService.update(
      ctx.tenant,
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(workScheduleDto(schedule))
  }

  @ApiOperation({ summary: 'Delete a work schedule' })
  async destroySchedule(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    await workScheduleService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Active badge of an employee (masked UID)' })
  async badge(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manageBadges')
    const badge = await badgeService.current(ctx.tenant, params.id)
    return { data: badge ? badgeDto(badge) : null }
  }

  @ApiOperation({ summary: 'Assign a badge (the previous one is revoked)' })
  @ApiBody({ type: () => assignBadgeValidator })
  async assignBadge(ctx: HttpContext) {
    const { params, badgeUid } = await ctx.request.validateUsing(assignBadgeValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manageBadges')
    const badge = await badgeService.assign(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      badgeUid,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(badgeDto(badge))
  }

  @ApiOperation({ summary: 'Revoke the badge of an employee' })
  async revokeBadge(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manageBadges')
    await badgeService.revokeOf(ctx.tenant, ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Badge journal' })
  async badgeEvents(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(badgeEventsValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const page = await badgeService.events(ctx.tenant, query)
    return { data: page.all().map(badgeEventDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Kiosk tokens' })
  async devices(ctx: HttpContext) {
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const devices = await deviceTokenService.list(ctx.tenant)
    return { data: devices.map(deviceTokenDto) }
  }

  @ApiOperation({ summary: 'Create a kiosk token (shown once)' })
  @ApiBody({ type: () => createDeviceTokenValidator })
  async storeDevice(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createDeviceTokenValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    const { device, token } = await deviceTokenService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize({ ...deviceTokenDto(device), token })
  }

  @ApiOperation({ summary: 'Kiosk token detail' })
  async device(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    return ctx.serialize(deviceTokenDto(await deviceTokenService.find(ctx.tenant, params.id)))
  }

  @ApiOperation({ summary: 'Revoke a kiosk token' })
  async revokeDevice(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('manage')
    await deviceTokenService.revoke(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }
}
