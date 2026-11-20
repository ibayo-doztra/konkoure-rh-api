import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import DashboardPolicy from '#policies/dashboard_policy'
import dashboardService from '#modules/dashboard/services/dashboard_service'
import { dashboardValidator } from '#modules/dashboard/validators/dashboard_validator'

/** `GET /api/v1/org/dashboard` (06 §3). */
export default class DashboardController {
  @ApiOperation({ summary: 'KPIs of the caller scope for the current week, month or quarter' })
  async show(ctx: HttpContext) {
    const { period } = await ctx.request.validateUsing(dashboardValidator)
    await ctx.bouncer.with(DashboardPolicy).authorize('view')
    return ctx.serialize(await dashboardService.show(ctx.tenant, period))
  }
}
