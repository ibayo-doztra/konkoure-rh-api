import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import TimeclockPolicy from '#policies/timeclock_policy'
import attendanceService from '#modules/timeclock/services/attendance_service'
import timeLogExportService from '#modules/timeclock/services/time_log_export_service'
import { attendanceDayDto, todayDto } from '#modules/timeclock/transformers/timeclock_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  exportLogsValidator,
  listAttendanceValidator,
} from '#modules/timeclock/validators/timeclock_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** Daily attendance, today's board and punch export (docs/backend/06 §6, lot 2). */
export default class AttendanceController {
  @ApiOperation({ summary: 'Daily attendance aggregates visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listAttendanceValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('listAttendance')
    const { rows, meta } = await attendanceService.list(ctx.tenant, query)
    return { data: rows.map(attendanceDayDto), meta: pageMetaDto(meta) }
  }

  @ApiOperation({ summary: 'Present, absent and on-leave employees today' })
  async today(ctx: HttpContext) {
    await ctx.bouncer.with(TimeclockPolicy).authorize('viewToday')
    return ctx.serialize(todayDto(await attendanceService.today(ctx.tenant)))
  }

  @ApiOperation({ summary: 'Export punches as CSV or XLSX, e-mailed (≤ 366 days)' })
  @ApiBody({ type: () => exportLogsValidator })
  async export(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(exportLogsValidator)
    await ctx.bouncer.with(TimeclockPolicy).authorize('exportLogs')
    const result = await timeLogExportService.request(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      query,
      auditContext(ctx)
    )
    ctx.response.status(202)
    return ctx.serialize(result)
  }
}
