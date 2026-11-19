import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import EmployeePolicy from '#policies/employee_policy'
import employeeImportService, {
  type ImportIssue,
} from '#modules/hr/services/employee_import_service'
import employeeExportService from '#modules/hr/services/employee_export_service'
import {
  exportEmployeesValidator,
  importCommitValidator,
  importPreviewValidator,
} from '#modules/hr/validators/employee_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** Import and export of employees (06 §4, 07 §1.7, 08 §9). Owner and hr_admin. */
export default class EmployeeTransfersController {
  @ApiOperation({ summary: 'Check an XLSX/CSV file line by line, without writing' })
  async preview(ctx: HttpContext) {
    const { file } = await ctx.request.validateUsing(importPreviewValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    const result = await employeeImportService.preview(ctx.tenant, ctx.auth.getUserOrFail(), file)
    const count = (action: string) => result.rows.filter((row) => row.action === action).length
    const translate = (found: ImportIssue) => ({
      line: found.line,
      field: found.field,
      rule: found.rule,
      message: ctx.i18n.t(found.message),
    })
    return ctx.serialize({
      importToken: result.importToken,
      expiresIn: result.expiresIn,
      summary: {
        total: result.rows.length,
        create: count('create'),
        update: count('update'),
        skip: count('skip'),
        error: count('error'),
      },
      rows: result.rows.map((row) => ({
        line: row.line,
        action: row.action,
        name: row.name,
        employeeId: row.employeeId,
      })),
      errors: result.issues.map(translate),
    })
  }

  @ApiOperation({ summary: 'Write a previewed import, all or nothing' })
  @ApiBody({ type: () => importCommitValidator })
  async commit(ctx: HttpContext) {
    const { importToken } = await ctx.request.validateUsing(importCommitValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    const report = await employeeImportService.commit(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      importToken,
      auditContext(ctx)
    )
    return ctx.serialize(report)
  }

  @ApiOperation({ summary: 'Export employees (asynchronous, link sent by e-mail)' })
  @ApiBody({ type: () => exportEmployeesValidator })
  async export(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(exportEmployeesValidator)
    await ctx.bouncer.with(EmployeePolicy).authorize('manage')
    const result = await employeeExportService.request(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(202)
    return ctx.serialize(result)
  }
}
