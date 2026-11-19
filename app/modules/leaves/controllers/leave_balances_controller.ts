import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import LeavePolicy from '#policies/leave_policy'
import leaveBalanceService from '#modules/leaves/services/leave_balance_service'
import { leaveBalanceDto } from '#modules/leaves/transformers/leave_transformer'
import {
  adjustBalanceValidator,
  employeeBalanceValidator,
  listBalancesValidator,
} from '#modules/leaves/validators/leave_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/leaves/balances` (06-api-reference §7). */
export default class LeaveBalancesController {
  @ApiOperation({ summary: 'Leave balances of a year visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listBalancesValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('list')
    const balances = await leaveBalanceService.list(ctx.tenant, query)
    return { data: balances.map(leaveBalanceDto) }
  }

  @ApiOperation({ summary: 'Leave balances of one employee for a year' })
  async ofEmployee(ctx: HttpContext) {
    const { params, year } = await ctx.request.validateUsing(employeeBalanceValidator)
    const { employee, inTeam } = await leaveBalanceService.employeeScope(ctx.tenant, params.id)
    await ctx.bouncer.with(LeavePolicy).authorize('viewBalanceOf', employee.id, inTeam)
    const balances = await leaveBalanceService.list(ctx.tenant, { employeeId: employee.id, year })
    return { data: balances.map(leaveBalanceDto) }
  }

  @ApiOperation({ summary: 'Adjust an entitlement (audited, journaled)' })
  @ApiBody({ type: () => adjustBalanceValidator })
  async adjust(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(adjustBalanceValidator)
    await ctx.bouncer.with(LeavePolicy).authorize('adjustBalance')
    const balance = await leaveBalanceService.adjust(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    return ctx.serialize(leaveBalanceDto(balance))
  }
}
