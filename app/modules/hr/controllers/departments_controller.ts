import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import DepartmentPolicy from '#policies/department_policy'
import departmentService from '#modules/hr/services/department_service'
import employeeService from '#modules/hr/services/employee_service'
import { departmentDto, employeeDto, pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  createDepartmentValidator,
  deleteDepartmentValidator,
  departmentIdValidator,
  updateDepartmentValidator,
} from '#modules/hr/validators/department_validator'
import {
  nestedEmployeesValidator,
  paginationValidator,
} from '#modules/hr/validators/employee_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/departments` (06-api-reference §5). */
export default class DepartmentsController {
  @ApiOperation({ summary: 'List departments (?page, ?perPage)' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(paginationValidator)
    const page = await departmentService.list(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    })
    return { data: page.all().map(departmentDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Department detail' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(departmentIdValidator)
    return ctx.serialize(departmentDto(await departmentService.find(ctx.tenant, params.id)))
  }

  @ApiOperation({ summary: 'Create a department' })
  @ApiBody({ type: () => createDepartmentValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createDepartmentValidator)
    await ctx.bouncer.with(DepartmentPolicy).authorize('manage')
    const department = await departmentService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(departmentDto(department))
  }

  @ApiOperation({ summary: 'Update a department' })
  @ApiBody({ type: () => updateDepartmentValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateDepartmentValidator)
    await ctx.bouncer.with(DepartmentPolicy).authorize('manage')
    const department = await departmentService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(departmentDto(department))
  }

  @ApiOperation({ summary: 'Delete a department (?reassignTo moves its employees)' })
  async destroy(ctx: HttpContext) {
    const { params, reassignTo } = await ctx.request.validateUsing(deleteDepartmentValidator)
    await ctx.bouncer.with(DepartmentPolicy).authorize('manage')
    await departmentService.remove(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      reassignTo,
      auditContext(ctx)
    )
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Employees of a department, within the viewer scope' })
  async employees(ctx: HttpContext) {
    const { params, ...query } = await ctx.request.validateUsing(nestedEmployeesValidator)
    await ctx.bouncer.with(DepartmentPolicy).authorize('listEmployees')
    await departmentService.find(ctx.tenant, params.id)
    const { rows, meta } = await employeeService.list(ctx.tenant, query, {
      departmentId: params.id,
    })
    return {
      data: rows.map((row) => employeeDto(row.employee, row.visibility)),
      meta: pageMetaDto(meta),
    }
  }
}
