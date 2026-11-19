import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import LeavePolicy from '#policies/leave_policy'
import holidayService from '#modules/leaves/services/holiday_service'
import { holidayDto } from '#modules/leaves/transformers/leave_transformer'
import {
  createHolidayValidator,
  holidayIdValidator,
  importHolidaysValidator,
  listHolidaysValidator,
  updateHolidayValidator,
} from '#modules/leaves/validators/leave_validator'

/** `/api/v1/org/holidays` (06-api-reference §7, 07 §9). Read: everyone; write: O/H. */
export default class HolidaysController {
  @ApiOperation({ summary: 'Public holidays of a year' })
  async index(ctx: HttpContext) {
    const { year } = await ctx.request.validateUsing(listHolidaysValidator)
    const holidays = await holidayService.list(ctx.tenant, year)
    return { data: holidays.map(holidayDto) }
  }

  @ApiOperation({ summary: 'Add a public holiday' })
  @ApiBody({ type: () => createHolidayValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createHolidayValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('manageHolidays')
    const holiday = await holidayService.create(ctx.tenant, input)
    ctx.response.status(201)
    return ctx.serialize(holidayDto(holiday))
  }

  @ApiOperation({ summary: 'Change a public holiday' })
  @ApiBody({ type: () => updateHolidayValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateHolidayValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('manageHolidays')
    const holiday = await holidayService.update(ctx.tenant, params.id, input)
    return ctx.serialize(holidayDto(holiday))
  }

  @ApiOperation({ summary: 'Delete a public holiday' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(holidayIdValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('manageHolidays')
    await holidayService.remove(ctx.tenant, params.id)
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Import the fixed Guinean holidays of a year' })
  @ApiBody({ type: () => importHolidaysValidator })
  async import(ctx: HttpContext) {
    const { year } = await ctx.request.validateUsing(importHolidaysValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('manageHolidays')
    const holidays = await holidayService.importYear(ctx.tenant, year)
    return { data: holidays.map(holidayDto) }
  }
}
