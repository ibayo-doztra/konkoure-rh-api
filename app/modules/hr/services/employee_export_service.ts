import limiter from '@adonisjs/limiter/services/main'
import type User from '#models/user'
import type { EmployeeStatus } from '#models/employee'
import type { ContractType } from '#models/contract'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { filesIn } from '#shared/files/file_repository'
import fileStorage from '#shared/files/file_storage'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import queueService from '#shared/queue/queue_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import users from '#modules/users/repositories/user_repository'
import { contractsIn } from '#modules/hr/repositories/contract_repository'
import { departmentsIn } from '#modules/hr/repositories/department_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { EMPLOYEE_COLUMNS, EXPORT_ONLY_COLUMNS } from '#modules/hr/import/employee_columns'
import { writeCsv, writeXlsx, type SheetFormat } from '#modules/hr/import/spreadsheet'
import { EmployeesExportMail } from '#modules/hr/mails/employees_export_mail'

/** The e-mailed link stays valid 24 hours (docs/backend/08 §9). */
const LINK_TTL_SECONDS = 24 * 3600
const PAGE_SIZE = 500

export interface ExportFilters {
  status?: EmployeeStatus
  departmentId?: string
  managerId?: string
  contractType?: ContractType
}

export interface ExportJob {
  exportId: string
  organizationId: string
  userId: string
  format: SheetFormat
  filters: ExportFilters
}

/**
 * Asynchronous employee export (08 §9): the request is answered `202` with a
 * job id; the worker writes the file to `private-docs` and e-mails a link
 * valid 24 hours. The salary is never exported.
 */
export class EmployeeExportService {
  /** 5 exports per hour and user (05 §8). */
  async request(
    tenant: TenantContext,
    actor: User,
    input: { format: SheetFormat; filter?: ExportFilters },
    audit: AuditContext
  ) {
    await limiter.use({ requests: 5, duration: '1 hour' }).consume(`employees-export:${actor.id}`)
    const job: ExportJob = {
      exportId: newId(),
      organizationId: tenant.organizationId,
      userId: actor.id,
      format: input.format,
      filters: input.filter ?? {},
    }
    await withTenant(tenant.organizationId, (trx) =>
      auditService.record(
        trx,
        { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole },
        {
          action: 'employee.exported',
          targetType: 'organization',
          targetId: tenant.organizationId,
          after: { exportId: job.exportId, format: job.format, filters: job.filters },
        }
      )
    )
    try {
      await queueService.dispatch('employees.export', job)
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
    return { jobId: job.exportId }
  }

  /** Worker side: builds, stores and announces the file. Returns the number of rows. */
  async build(job: ExportJob) {
    const user = await users.findById(job.userId)
    if (!user) return 0
    const rows = await withTenant(job.organizationId, (trx) => this.rows(trx, job))
    const content = job.format === 'csv' ? writeCsv(rows) : await writeXlsx(rows, 'Employés')
    const extension = job.format
    const mime =
      job.format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const key = fileStorage.key(job.organizationId, 'export', job.userId, extension)
    const stored = await fileStorage.put('private', key, { content, type: { mime, extension } })
    await withTenant(job.organizationId, (trx) =>
      filesIn(job.organizationId, trx).create({
        ...stored,
        ownerType: 'employee_export',
        ownerId: job.userId,
        uploadedBy: job.userId,
      })
    )
    const { url } = await fileStorage.signedUrl(key, LINK_TTL_SECONDS)
    await dispatchMail(new EmployeesExportMail(user, { url, rows: rows.length - 1 }))
    return rows.length - 1
  }

  private async rows(trx: Parameters<Parameters<typeof withTenant>[1]>[0], job: ExportJob) {
    const employees = employeesIn(job.organizationId, trx)
    const allDepartments = await departmentsIn(job.organizationId, trx).all()
    const departments = new Map(allDepartments.map((row) => [row.id, row.name]))
    const header = [...EMPLOYEE_COLUMNS, ...EXPORT_ONLY_COLUMNS].map((column) => column.fr)
    const rows: string[][] = [header]
    const names = new Map<string, string>()
    const records = []
    for (let page = 1; ; page += 1) {
      const result = await employees.paginate({
        page,
        perPage: PAGE_SIZE,
        searchPrivateFields: true,
        status: job.filters.status,
        departmentId: job.filters.departmentId,
        managerId: job.filters.managerId,
        contractType: job.filters.contractType,
        sort: 'last_name',
      })
      records.push(...result.all())
      if (page >= result.lastPage) break
    }
    for (const record of records) names.set(record.id, `${record.firstName} ${record.lastName}`)
    const managerIds = records
      .map((record) => record.managerId)
      .filter((id): id is string => id !== null && !names.has(id))
    for (const [id, name] of await employees.namesOf([...new Set(managerIds)])) names.set(id, name)
    const contracts = await contractsIn(job.organizationId, trx).activeTypesOf(
      records.map((record) => record.id)
    )

    const day = (value: { toISODate(): string | null } | null) => value?.toISODate() ?? ''
    for (const record of records) {
      rows.push([
        record.employeeNumber ?? '',
        record.lastName,
        record.firstName,
        record.email ?? '',
        record.phone ?? '',
        record.jobTitle ?? '',
        record.departmentId ? (departments.get(record.departmentId) ?? '') : '',
        record.managerId ? (names.get(record.managerId) ?? '') : '',
        day(record.hireDate),
        day(record.birthDate),
        record.status,
        day(record.endDate),
        contracts.get(record.id) ?? '',
      ])
    }
    return rows
  }
}

export default new EmployeeExportService()
