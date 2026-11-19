import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import redis from '@adonisjs/redis/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Employee from '#models/employee'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { randomToken } from '#shared/utils/crypto'
import entitlementService from '#modules/billing/services/entitlement_service'
import { departmentsIn } from '#modules/hr/repositories/department_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import teamCache from '#modules/hr/team_cache'
import {
  departmentKey,
  mapHeader,
  personKey,
  type ImportColumn,
} from '#modules/hr/import/employee_columns'
import { readSheet } from '#modules/hr/import/spreadsheet'

/** Limits of 07 §1.7. */
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 2000
/** A preview can be committed for 30 minutes. */
const TOKEN_TTL_SECONDS = 30 * 60
const MAX_DEPTH = 10

export interface ImportIssue {
  /** Line of the file (1 = header). 0 = the whole file. */
  line: number
  field: string
  rule: string
  /** i18n key, translated by the controller. */
  message: string
}

type RawRow = { line: number; values: Partial<Record<ImportColumn, string>> }

interface RowFields {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  employeeNumber: string | null
  jobTitle: string | null
  hireDate: string | null
  birthDate: string | null
}

export interface PlannedRow {
  line: number
  action: 'create' | 'update' | 'skip' | 'error'
  employeeId: string | null
  name: string
  fields: Partial<RowFields>
  departmentId?: string | null
  /** Existing employee id, or `line:<n>` for a row created by this import. */
  managerRef?: string | null
}

interface Plan {
  rows: PlannedRow[]
  issues: ImportIssue[]
}

const issue = (line: number, field: string, rule: string): ImportIssue => ({
  line,
  field,
  rule,
  message: `validation.import.${rule}`,
})

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** `YYYY-MM-DD` or `DD/MM/YYYY`, as an ISO day; `undefined` when invalid. */
function parseDay(value: string): string | undefined {
  const iso = DateTime.fromISO(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && iso.isValid) return iso.toISODate()!
  const french = DateTime.fromFormat(value, 'dd/MM/yyyy')
  return french.isValid ? french.toISODate()! : undefined
}

const isoOf = (date: DateTime | null) => (date ? date.toISODate() : null)

/**
 * Bulk employee import (docs/backend/07 §1.7): `preview` checks every line and
 * keeps the parsed rows 30 minutes behind a token; `commit` plans them again
 * against the current data and writes all of them or none.
 */
export class EmployeeImportService {
  async preview(tenant: TenantContext, actor: User, file: MultipartFile) {
    const rows = await this.read(file)
    const plan = await withTenant(tenant.organizationId, (trx) =>
      this.plan(trx, tenant.organizationId, rows)
    )
    const importToken = randomToken(24, 'imp_')
    await this.store(tenant.organizationId, importToken, { userId: actor.id, rows })
    return { importToken, expiresIn: TOKEN_TTL_SECONDS, ...plan }
  }

  async commit(tenant: TenantContext, actor: User, importToken: string, audit: AuditContext) {
    const { organizationId } = tenant
    const stored = await this.load(organizationId, importToken)
    if (!stored || stored.userId !== actor.id) {
      throw AppException.validation('importToken', 'expired', 'validation.import.tokenExpired')
    }

    const report = await withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      await employees.lockHierarchy()
      const plan = await this.plan(trx, organizationId, stored.rows)
      if (plan.issues.length > 0) {
        throw new AppException('E_VALIDATION', {
          details: plan.issues.map((found) => ({
            field: `line:${found.line}.${found.field}`,
            rule: found.rule,
            message: found.message,
          })),
        })
      }
      return this.write(trx, tenant, actor, plan.rows, audit)
    })
    await teamCache.invalidate(organizationId)
    await this.forget(organizationId, importToken)
    return report
  }

  /** Size, format and row count, then the rows keyed by column (line 1 = header). */
  private async read(file: MultipartFile): Promise<RawRow[]> {
    if (file.size > MAX_FILE_BYTES) throw new AppException('E_PAYLOAD_TOO_LARGE')
    if (!file.tmpPath) throw new AppException('E_BAD_REQUEST')
    const sheet = await readSheet(await readFile(file.tmpPath), MAX_ROWS)
    if (!sheet.ok) {
      throw AppException.validation('file', sheet.reason, `validation.import.${sheet.reason}`)
    }
    const [header = [], ...data] = sheet.rows
    const positions = mapHeader(header)
    for (const required of ['firstName', 'lastName'] as const) {
      if (!positions.has(required)) {
        throw AppException.validation('file', 'missingColumn', 'validation.import.missingColumn')
      }
    }
    return data.map((cells, index) => {
      const values: RawRow['values'] = {}
      for (const [key, position] of positions) {
        const value = (cells[position] ?? '').trim()
        if (value !== '') values[key] = value
      }
      return { line: index + 2, values }
    })
  }

  /** Checks every row against the file and the organization; nothing is written. */
  private async plan(
    trx: TransactionClientContract,
    organizationId: string,
    rows: RawRow[]
  ): Promise<Plan> {
    const issues: ImportIssue[] = []
    const existing = await employeesIn(organizationId, trx).importIndex()
    const departments = await departmentsIn(organizationId, trx).all()
    const byNumber = new Map<string, Employee>()
    const byEmail = new Map<string, Employee>()
    for (const employee of existing) {
      if (employee.employeeNumber) byNumber.set(employee.employeeNumber, employee)
      if (employee.email) byEmail.set(employee.email.toLowerCase(), employee)
    }
    const departmentIds = new Map(departments.map((row) => [departmentKey(row.name), row.id]))

    const seenNumbers = new Map<string, number>()
    const seenEmails = new Map<string, number>()
    const planned: PlannedRow[] = []
    for (const row of rows) {
      const before = issues.length
      const fields = this.fields(row, issues)
      const name = `${fields.firstName ?? ''} ${fields.lastName ?? ''}`.trim()
      const email = fields.email?.toLowerCase() ?? null

      if (fields.employeeNumber) {
        if (seenNumbers.has(fields.employeeNumber)) {
          issues.push(issue(row.line, 'employeeNumber', 'duplicateInFile'))
        }
        seenNumbers.set(fields.employeeNumber, row.line)
      }
      if (email) {
        if (seenEmails.has(email)) issues.push(issue(row.line, 'email', 'duplicateInFile'))
        seenEmails.set(email, row.line)
      }

      // An existing record is matched by employee number, else by e-mail.
      const numbered = fields.employeeNumber ? byNumber.get(fields.employeeNumber) : undefined
      const mailed = email ? byEmail.get(email) : undefined
      if (numbered && mailed && numbered.id !== mailed.id) {
        issues.push(issue(row.line, 'email', 'emailTaken'))
      }
      const match = numbered ?? mailed ?? null

      let departmentId: string | null | undefined
      if (row.values.department) {
        departmentId = departmentIds.get(departmentKey(row.values.department))
        if (!departmentId) issues.push(issue(row.line, 'department', 'unknownDepartment'))
      }

      planned.push({
        line: row.line,
        action: issues.length > before ? 'error' : match ? 'update' : 'create',
        employeeId: match?.id ?? null,
        name,
        fields,
        departmentId,
      })
    }

    this.resolveManagers(rows, planned, existing, issues)
    this.detectCycles(planned, existing, issues)
    this.markUnchanged(planned, existing)
    await this.checkQuota(organizationId, existing, planned, issues)

    for (const row of planned) {
      if (row.action !== 'error' && issues.some((found) => found.line === row.line)) {
        row.action = 'error'
      }
    }
    return { rows: planned, issues }
  }

  /** Same limits as POST /org/employees (06 §4). */
  private fields(row: RawRow, issues: ImportIssue[]): Partial<RowFields> {
    const { values } = row
    const fields: Partial<RowFields> = {}
    const text = (key: keyof RowFields & ImportColumn, min: number, max: number) => {
      const value = values[key]
      if (value === undefined) {
        if (min > 0) issues.push(issue(row.line, key, 'required'))
        return
      }
      if (value.length < min || value.length > max) issues.push(issue(row.line, key, 'length'))
      else fields[key] = value
    }
    text('firstName', 2, 80)
    text('lastName', 2, 80)
    text('phone', 0, 30)
    text('employeeNumber', 0, 40)
    text('jobTitle', 0, 120)
    if (values.email !== undefined) {
      if (values.email.length > 255 || !EMAIL.test(values.email)) {
        issues.push(issue(row.line, 'email', 'email'))
      } else {
        fields.email = values.email.toLowerCase()
      }
    }
    for (const key of ['hireDate', 'birthDate'] as const) {
      if (values[key] === undefined) continue
      const date = parseDay(values[key]!)
      if (date) fields[key] = date
      else issues.push(issue(row.line, key, 'date'))
    }
    return fields
  }

  /** By "First Last", among existing records and the rows of the file. */
  private resolveManagers(
    rows: RawRow[],
    planned: PlannedRow[],
    existing: Employee[],
    issues: ImportIssue[]
  ) {
    const candidates = new Map<string, Set<string>>()
    const add = (key: string, ref: string) => {
      const set = candidates.get(key) ?? new Set<string>()
      set.add(ref)
      candidates.set(key, set)
    }
    const updated = new Set(planned.filter((row) => row.employeeId).map((row) => row.employeeId!))
    for (const employee of existing) {
      if (!updated.has(employee.id))
        add(personKey(employee.firstName, employee.lastName), employee.id)
    }
    for (const row of planned) {
      if (!row.fields.firstName || !row.fields.lastName) continue
      add(
        personKey(row.fields.firstName, row.fields.lastName),
        row.employeeId ?? `line:${row.line}`
      )
    }

    rows.forEach((raw, index) => {
      const row = planned[index]
      const wanted = raw.values.manager
      if (wanted === undefined) return
      const found = candidates.get(personKey(wanted, ''))
      if (!found || found.size === 0) issues.push(issue(row.line, 'manager', 'unknownManager'))
      else if (found.size > 1) issues.push(issue(row.line, 'manager', 'ambiguousManager'))
      else row.managerRef = [...found][0]
    })
  }

  /** The final hierarchy (07 §1.3): no cycle, depth at most 10. */
  private detectCycles(planned: PlannedRow[], existing: Employee[], issues: ImportIssue[]) {
    const parent = new Map<string, string | null>(existing.map((row) => [row.id, row.managerId]))
    const refOf = (row: PlannedRow) => row.employeeId ?? `line:${row.line}`
    for (const row of planned) {
      if (row.managerRef !== undefined) parent.set(refOf(row), row.managerRef)
      else if (!row.employeeId) parent.set(refOf(row), null)
    }
    for (const row of planned) {
      if (row.managerRef === undefined || row.managerRef === null) continue
      const start = refOf(row)
      let current: string | null | undefined = row.managerRef
      for (let depth = 0; current && depth <= MAX_DEPTH; depth += 1) {
        if (current === start) {
          issues.push(issue(row.line, 'manager', 'cycle'))
          break
        }
        current = parent.get(current)
      }
    }
  }

  /** An update that changes nothing is reported as skipped. */
  private markUnchanged(planned: PlannedRow[], existing: Employee[]) {
    const byId = new Map(existing.map((row) => [row.id, row]))
    for (const row of planned) {
      if (row.action !== 'update' || !row.employeeId) continue
      const current = byId.get(row.employeeId)!
      const same =
        Object.entries(row.fields).every(([key, value]) => {
          const actual = current[key as keyof RowFields]
          const normalized =
            actual instanceof DateTime ? isoOf(actual) : (actual as string | null | undefined)
          return key === 'email'
            ? (normalized ?? '').toLowerCase() === value
            : (normalized ?? null) === value
        }) &&
        (row.departmentId === undefined || row.departmentId === current.departmentId) &&
        (row.managerRef === undefined || row.managerRef === current.managerId)
      if (same) row.action = 'skip'
    }
  }

  /** New records count against `max_employees` (07 §1.1). */
  private async checkQuota(
    organizationId: string,
    existing: Employee[],
    planned: PlannedRow[],
    issues: ImportIssue[]
  ) {
    const entitlements = await entitlementService.resolve(organizationId)
    if (!entitlements) throw new AppException('E_SUBSCRIPTION_INACTIVE')
    const headcount = existing.filter((row) => row.status !== 'terminated').length
    const created = planned.filter((row) => row.action === 'create').length
    if (headcount + created > entitlements.maxEmployees) {
      issues.push(issue(0, 'file', 'quotaExceeded'))
    }
  }

  private async write(
    trx: TransactionClientContract,
    tenant: TenantContext,
    actor: User,
    rows: PlannedRow[],
    audit: AuditContext
  ) {
    const employees = employeesIn(tenant.organizationId, trx)
    const ids = new Map<string, string>()
    let created = 0
    let updated = 0
    let skipped = 0

    for (const row of rows) {
      const columns = {
        ...row.fields,
        hireDate: row.fields.hireDate ? DateTime.fromISO(row.fields.hireDate) : undefined,
        birthDate: row.fields.birthDate ? DateTime.fromISO(row.fields.birthDate) : undefined,
        ...(row.departmentId !== undefined ? { departmentId: row.departmentId } : {}),
      }
      const defined = Object.fromEntries(
        Object.entries(columns).filter(([, value]) => value !== undefined)
      )
      if (row.action === 'create') {
        const employee = await employees.create({
          ...defined,
          firstName: row.fields.firstName!,
          lastName: row.fields.lastName!,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        ids.set(`line:${row.line}`, employee.id)
        created += 1
      } else if (row.action === 'update') {
        const employee = await employees.findForUpdate(row.employeeId!)
        if (!employee) throw new AppException('E_CONFLICT')
        employee.merge({ ...defined, updatedBy: actor.id })
        await employees.save(employee)
        updated += 1
      } else {
        skipped += 1
      }
    }

    // Managers last: a row may report to another row of the same file.
    for (const row of rows) {
      if (row.action === 'skip' || row.managerRef === undefined) continue
      const id = row.employeeId ?? ids.get(`line:${row.line}`)!
      const managerId = row.managerRef?.startsWith('line:')
        ? ids.get(row.managerRef)!
        : row.managerRef
      const employee = await employees.findForUpdate(id)
      employee!.merge({ managerId })
      await employees.save(employee!)
    }

    await auditService.record(
      trx,
      { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole },
      {
        action: 'employee.imported',
        targetType: 'organization',
        targetId: tenant.organizationId,
        after: { created, updated, skipped, lines: rows.length },
      }
    )
    return { created, updated, skipped, errors: [] as ImportIssue[] }
  }

  private key(organizationId: string, token: string) {
    return `import:${organizationId}:${token}`
  }

  private async store(organizationId: string, token: string, value: object) {
    try {
      await redis
        .connection('cache')
        .set(this.key(organizationId, token), JSON.stringify(value), 'EX', TOKEN_TTL_SECONDS)
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
  }

  private async load(
    organizationId: string,
    token: string
  ): Promise<{ userId: string; rows: RawRow[] } | null> {
    try {
      const raw = await redis.connection('cache').get(this.key(organizationId, token))
      return raw ? JSON.parse(raw) : null
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
  }

  private async forget(organizationId: string, token: string) {
    try {
      await redis.connection('cache').del(this.key(organizationId, token))
    } catch {
      // Expires on its own; a second commit is refused by idempotency or re-planned.
    }
  }
}

export default new EmployeeImportService()
