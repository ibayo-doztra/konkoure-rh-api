import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import EmployeePolicy from '#policies/employee_policy'
import employeeService from '#modules/hr/services/employee_service'
import employeeFileService from '#modules/hr/services/employee_file_service'
import { employeeVisibility } from '#modules/hr/employee_visibility'
import {
  employeeDocumentDto,
  employeeDto,
  employeeReducedDto,
  employeeSalaryDto,
  pageMetaDto,
} from '#modules/hr/transformers/hr_transformer'
import {
  addDocumentValidator,
  createEmployeeValidator,
  documentIdValidator,
  employeeIdValidator,
  listEmployeesValidator,
  nestedEmployeesValidator,
  paginationValidator,
  photoValidator,
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

  @ApiOperation({ summary: 'Documents of an employee' })
  async documents(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(employeeIdValidator)
    const { employee } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('manageOwnFiles', employee)
    const documents = await employeeFileService.documents(ctx.tenant, employee.id)
    return { data: documents.map(employeeDocumentDto) }
  }

  @ApiOperation({ summary: 'Add a document (PDF or image, 10 MB)' })
  async storeDocument(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(addDocumentValidator)
    const { employee } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('manageOwnFiles', employee)
    const document = await employeeFileService.addDocument(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      employee,
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(employeeDocumentDto(document))
  }

  @ApiOperation({ summary: 'Signed link to a document (audited)' })
  async documentUrl(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(documentIdValidator)
    const { employee } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('manageOwnFiles', employee)
    const document = await employeeFileService.find(ctx.tenant, employee.id, params.docId)
    return ctx.serialize(
      await employeeFileService.documentUrl(ctx.tenant, document, auditContext(ctx))
    )
  }

  @ApiOperation({ summary: 'Delete a document' })
  async destroyDocument(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(documentIdValidator)
    const { employee } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    await employeeFileService.removeDocument(
      ctx.tenant,
      employee.id,
      params.docId,
      auditContext(ctx)
    )
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Replace the photo (PNG, JPEG or WebP, 2 MB)' })
  async photo(ctx: HttpContext) {
    const { params, file } = await ctx.request.validateUsing(photoValidator)
    const { employee, inTeam } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(EmployeePolicy).authorize('manageOwnFiles', employee)
    const updated = await employeeFileService.replacePhoto(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      employee.id,
      file,
      auditContext(ctx)
    )
    return ctx.serialize(
      employeeDto(updated, employeeVisibility(ctx.tenant, updated, inTeam) ?? 'reduced')
    )
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
