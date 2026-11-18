import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import EmployeePolicy from '#policies/employee_policy'
import employeeService from '#modules/hr/services/employee_service'
import { employeeVisibility } from '#modules/hr/employee_visibility'
import {
  employeeDto,
  employeeReducedDto,
  employeeSalaryDto,
  pageMetaDto,
} from '#modules/hr/transformers/hr_transformer'
import {
  createEmployeeValidator,
  employeeIdValidator,
  listEmployeesValidator,
  nestedEmployeesValidator,
  paginationValidator,
  updateEmployeeValidator,
} from '#modules/hr/validators/employee_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/employees` (06-api-reference §4). */
export default class EmployeesController {
  @ApiOperation({ summary: 'List the employees visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listEmployeesValidator)
    const { rows, meta } = await employeeService.list(ctx.tenant, query)
    return {
      data: rows.map((row) => employeeDto(row.employee, row.visibility)),
      meta: pageMetaDto(meta),
    }
  }

  @ApiOperation({ summary: 'Employees eligible as manager (N+1)' })
  async managers(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(paginationValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('listManagers')
    const page = await employeeService.managers(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    })
    return { data: page.all().map(employeeReducedDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Employee detail, fields depend on the caller' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(employeeIdValidator)
    const { employee, inTeam } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('view', employee, inTeam)
    return ctx.serialize(
      employeeDto(employee, employeeVisibility(ctx.tenant, employee, inTeam) ?? 'reduced')
    )
  }

  @ApiOperation({ summary: 'Create an employee' })
  @ApiBody({ type: () => createEmployeeValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createEmployeeValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    const employee = await employeeService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(employeeDto(employee, 'full'))
  }

  @ApiOperation({ summary: 'Update an employee' })
  @ApiBody({ type: () => updateEmployeeValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateEmployeeValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    const employee = await employeeService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(employeeDto(employee, 'full'))
  }

  @ApiOperation({ summary: 'Delete an employee (soft delete)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(employeeIdValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    await employeeService.remove(ctx.tenant, ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Restore a deleted employee' })
  async restore(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(employeeIdValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    const employee = await employeeService.restore(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(employeeDto(employee, 'full'))
  }

  @ApiOperation({ summary: 'Salary of an employee (audited)' })
  async salary(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(employeeIdValidator)
    const { employee } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('viewSalary', employee)
    await employeeService.recordSalaryView(ctx.tenant, employee, auditContext(ctx))
    return ctx.serialize(employeeSalaryDto(employee))
  }

  @ApiOperation({ summary: 'Direct and indirect reports of an employee' })
  async team(ctx: HttpContext) {
    const { params, ...query } = await ctx.request.validateUsing(nestedEmployeesValidator)
    const { employee, inTeam } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('viewTeam', employee, inTeam)
    const { rows, meta } = await employeeService.team(ctx.tenant, employee.id, query)
    return {
      data: rows.map((row) => employeeDto(row.employee, row.visibility)),
      meta: pageMetaDto(meta),
    }
  }
}
