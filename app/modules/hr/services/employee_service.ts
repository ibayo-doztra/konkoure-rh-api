import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Employee from '#models/employee'
import type { EmployeeStatus } from '#models/employee'
import type { ContractType } from '#models/contract'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import teamCache from '#modules/hr/team_cache'
import leaveService from '#modules/leaves/services/leave_service'
import badgeService from '#modules/timeclock/services/badge_service'
import type { TenantContext } from '#shared/tenant/tenant_context'
import entitlementService from '#modules/billing/services/entitlement_service'
import organizations from '#modules/organizations/repositories/organization_repository'
import memberService from '#modules/organizations/services/member_service'
import contractService from '#modules/hr/services/contract_service'
import { departmentsIn } from '#modules/hr/repositories/department_repository'
import {
  employeesIn,
  type EmployeeRepository,
  type EmployeeSortField,
} from '#modules/hr/repositories/employee_repository'
import { employeeVisibility } from '#modules/hr/employee_visibility'

export interface EmployeeInput {
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  employeeNumber?: string | null
  jobTitle?: string | null
  departmentId?: string | null
  managerId?: string | null
  hireDate?: DateTime | null
  status?: EmployeeStatus
  baseSalary?: number | null
  salaryCurrency?: string | null
  birthDate?: DateTime | null
  address?: Record<string, unknown>
  emergencyContact?: Record<string, unknown>
}

export interface EmployeeListQuery {
  page?: number
  perPage?: number
  q?: string
  sort?: `${'' | '-'}${EmployeeSortField}`
  filter?: {
    status?: EmployeeStatus
    departmentId?: string
    managerId?: string
    contractType?: ContractType
  }
}

/** Fields whose values may appear in the journal; the others are only named. */
const AUDITED_VALUES = ['status', 'departmentId', 'managerId', 'jobTitle'] as const

const conflict = (field: string, rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field, rule, message }] })

function columns(input: EmployeeInput) {
  const { baseSalary, ...rest } = input
  const values = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  ) as Omit<EmployeeInput, 'baseSalary'>
  return baseSalary === undefined
    ? values
    : { ...values, baseSalary: baseSalary === null ? null : String(baseSalary) }
}

/** Employee records (docs/backend/06 §4, 07 §1). */
export class EmployeeService {
  /** The record and whether it belongs to the viewer's team. */
  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      const employee = await employees.findOrFail(id)
      const inTeam =
        tenant.hasRole('manager') && tenant.employeeId
          ? await employees.isInTeamOf(tenant.employeeId, id)
          : false
      return { employee, inTeam }
    })
  }

  /** Records the viewer may see, each with what they may read of it (04 §5). */
  list(tenant: TenantContext, query: EmployeeListQuery, within?: { departmentId?: string }) {
    return this.page(tenant, query, within?.departmentId)
  }

  /** Direct and indirect reports of an employee, within the viewer's own scope. */
  team(tenant: TenantContext, employeeId: string, query: EmployeeListQuery) {
    return this.page(tenant, query, undefined, employeeId)
  }

  private page(
    tenant: TenantContext,
    query: EmployeeListQuery,
    departmentId?: string,
    teamOf?: string
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      const self = tenant.employeeId
      const team = new Set(tenant.hasRole('manager') && self ? await employees.teamIds(self) : [])

      let ids: string[] | undefined
      if (!tenant.hasRole('owner', 'hr_admin', 'recruiter', 'security_agent')) {
        ids = [...team, ...(self ? [self] : [])]
      }
      if (teamOf) {
        const reports = await employees.teamIds(teamOf)
        ids = ids ? reports.filter((id) => ids!.includes(id)) : reports
      }

      // Recruiters and agents read reduced fields: they cannot search or sort on the others.
      const privateAccess = tenant.hasRole('owner', 'hr_admin', 'manager')
      const sort = query.sort?.replace('-', '') as EmployeeSortField | undefined
      const page = await employees.paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        q: query.q,
        searchPrivateFields: privateAccess,
        status: privateAccess ? query.filter?.status : undefined,
        managerId: privateAccess ? query.filter?.managerId : undefined,
        contractType: privateAccess ? query.filter?.contractType : undefined,
        departmentId: departmentId ?? query.filter?.departmentId,
        sort: privateAccess ? sort : undefined,
        descending: privateAccess && query.sort?.startsWith('-'),
        ids,
      })
      return {
        rows: page.all().map((employee) => ({
          employee,
          visibility: employeeVisibility(tenant, employee, team.has(employee.id)) ?? 'reduced',
        })),
        meta: page.getMeta(),
      }
    })
  }

  /** `GET /employees/directory`: reduced fields of present staff, for every member. */
  directory(
    tenant: TenantContext,
    filters: { page: number; perPage: number; q?: string; departmentId?: string }
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => employeesIn(organizationId, trx).directory(filters))
  }

  managers(tenant: TenantContext, filters: { page: number; perPage: number }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) =>
      employeesIn(organizationId, trx).eligibleManagers(filters)
    )
  }

  /** Reading a salary is journaled (05 §7). */
  async recordSalaryView(tenant: TenantContext, employee: Employee, audit: AuditContext) {
    await withTenant(tenant.organizationId, (trx) =>
      auditService.record(trx, this.context(tenant, audit), {
        action: 'salary.viewed',
        targetType: 'employee',
        targetId: employee.id,
      })
    )
  }

  async create(
    tenant: TenantContext,
    actor: User,
    input: EmployeeInput & { firstName: string; lastName: string },
    audit: AuditContext
  ): Promise<Employee> {
    const { organizationId } = tenant
    const limit = await this.maxEmployees(organizationId)
    const result = await withTenant(organizationId, (trx) =>
      this.createWithin(trx, tenant, actor, input, limit, audit)
    )
    await teamCache.invalidate(organizationId)
    return result
  }

  /**
   * Creation inside a tenant transaction opened by the caller (hiring,
   * 07 §4.6): quota, uniqueness and references are checked there. The caller
   * invalidates the team cache after its commit.
   */
  async createWithin(
    trx: TransactionClientContract,
    tenant: TenantContext,
    actor: User,
    input: EmployeeInput & { firstName: string; lastName: string },
    limit: number,
    audit: AuditContext
  ): Promise<Employee> {
    const employees = employeesIn(tenant.organizationId, trx)
    await employees.lockHierarchy()
    if (input.status !== 'terminated') await this.assertQuota(employees, limit)
    await this.assertUnique(employees, input)
    await this.assertReferences(employees, trx, input)

    const employee = await employees.create({
      ...columns(input),
      createdBy: actor.id,
      updatedBy: actor.id,
    })
    await auditService.record(trx, this.context(tenant, audit), {
      action: 'employee.created',
      targetType: 'employee',
      targetId: employee.id,
      after: { status: input.status ?? 'active', departmentId: input.departmentId ?? null },
    })
    await employee.refresh()
    return employee
  }

  /** Maximum headcount of the organization's plan (07 §6.3). */
  employeeLimit(organizationId: string) {
    return this.maxEmployees(organizationId)
  }

  async update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: EmployeeInput,
    audit: AuditContext
  ): Promise<Employee> {
    const { organizationId } = tenant
    const limit = await this.maxEmployees(organizationId)
    const result = await withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      await employees.lockHierarchy()
      const employee = await employees.findForUpdate(id)
      if (!employee) throw new AppException('E_NOT_FOUND')

      await this.assertUnique(employees, input, id)
      await this.assertReferences(employees, trx, input, id)

      const wasTerminated = employee.status === 'terminated'
      const nextStatus = input.status ?? employee.status
      if (wasTerminated && nextStatus !== 'terminated') {
        await this.assertQuota(employees, limit)
        employee.endDate = null
      }

      const changes = columns(input)
      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      for (const field of AUDITED_VALUES) {
        if (input[field] === undefined || input[field] === employee[field]) continue
        before[field] = employee[field]
        after[field] = input[field]
      }
      employee.merge({ ...changes, updatedBy: actor.id })

      if (!wasTerminated && nextStatus === 'terminated') {
        await this.terminate(tenant, actor, employee, trx, audit)
      }
      await employees.save(employee)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'employee.updated',
        targetType: 'employee',
        targetId: id,
        before,
        after: { ...after, changedFields: Object.keys(changes) },
      })
      await employee.refresh()
      return employee
    })
    await teamCache.invalidate(organizationId)
    return result
  }

  /** Soft delete (07 §1.6): the record stays referenced by journals and history. */
  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      await employees.lockHierarchy()
      const employee = await employees.findForUpdate(id)
      if (!employee) throw new AppException('E_NOT_FOUND')

      await this.detachFromHierarchy(employees, employee, trx)
      employee.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await employees.save(employee)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'employee.deleted',
        targetType: 'employee',
        targetId: id,
      })
    })
    await teamCache.invalidate(organizationId)
  }

  async restore(
    tenant: TenantContext,
    actor: User,
    id: string,
    audit: AuditContext
  ): Promise<Employee> {
    const { organizationId } = tenant
    const limit = await this.maxEmployees(organizationId)
    const result = await withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      await employees.lockHierarchy()
      const employee = await employees.findDeletedForUpdate(id)
      if (!employee) throw new AppException('E_NOT_FOUND')

      if (employee.status !== 'terminated') await this.assertQuota(employees, limit)
      await this.assertUnique(employees, { email: employee.email }, id)
      if (employee.userId && (await employees.findByUser(employee.userId))) {
        throw conflict('userId', 'alreadyLinked', 'validation.employee.alreadyLinked')
      }

      // Its manager or department may have been deleted in the meantime.
      if (employee.managerId && !(await employees.find(employee.managerId))) {
        employee.managerId = null
      }
      const departments = departmentsIn(organizationId, trx)
      if (employee.departmentId && !(await departments.find(employee.departmentId))) {
        employee.departmentId = null
      }
      employee.merge({ deletedAt: null, updatedBy: actor.id })
      await employees.save(employee)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'employee.restored',
        targetType: 'employee',
        targetId: id,
      })
      await employee.refresh()
      return employee
    })
    await teamCache.invalidate(organizationId)
    return result
  }

  /**
   * End of employment (07 §1.5): end date, active contract, pending leaves,
   * NFC badge, application roles and reports, in one transaction.
   */
  private async terminate(
    tenant: TenantContext,
    actor: User,
    employee: Employee,
    trx: TransactionClientContract,
    audit: AuditContext
  ) {
    if (employee.userId) {
      if (employee.userId === actor.id) throw new AppException('E_FORBIDDEN')
      await memberService.revokeAllIn(trx, tenant, employee.userId, audit)
    }
    const organization = await organizations.findActive(tenant.organizationId, trx)
    if (!organization) throw new AppException('E_NOT_FOUND')
    const endDate = employee.endDate ?? DateTime.now().setZone(organization.timezone).startOf('day')
    employee.endDate = endDate
    await contractService.closeActiveOf(trx, tenant, actor, employee.id, endDate, audit)
    await leaveService.cancelPendingOf(trx, tenant, actor, employee.id, audit)
    await badgeService.revokeAllOf(trx, tenant, actor, employee.id, audit)
    await this.detachFromHierarchy(employeesIn(tenant.organizationId, trx), employee, trx)
  }

  /** Reports move up to the departing employee's own manager. */
  private async detachFromHierarchy(
    employees: EmployeeRepository,
    employee: Employee,
    trx: TransactionClientContract
  ) {
    await employees.reassignReports(employee.id, employee.managerId)
    await departmentsIn(employees.organizationId, trx).clearManager(employee.id)
  }

  private async maxEmployees(organizationId: string) {
    const entitlements = await entitlementService.resolve(organizationId)
    if (!entitlements) throw new AppException('E_SUBSCRIPTION_INACTIVE')
    return entitlements.maxEmployees
  }

  private async assertQuota(employees: EmployeeRepository, limit: number) {
    if ((await employees.headcount()) >= limit) throw new AppException('E_QUOTA_EXCEEDED')
  }

  private async assertUnique(employees: EmployeeRepository, input: EmployeeInput, id?: string) {
    if (input.email && (await employees.emailTaken(input.email, id))) {
      throw conflict('email', 'taken', 'validation.employee.emailTaken')
    }
    if (input.employeeNumber && (await employees.numberTaken(input.employeeNumber, id))) {
      throw conflict('employeeNumber', 'taken', 'validation.employee.numberTaken')
    }
  }

  /** Client-supplied ids are re-read inside the organization (05 §2). */
  private async assertReferences(
    employees: EmployeeRepository,
    trx: TransactionClientContract,
    input: EmployeeInput,
    id?: string
  ) {
    if (input.departmentId) {
      const departments = departmentsIn(employees.organizationId, trx)
      if (!(await departments.find(input.departmentId))) {
        throw AppException.validation('departmentId', 'exists', 'validation.employee.department')
      }
    }
    if (!input.managerId) return
    if (!(await employees.find(input.managerId))) {
      throw AppException.validation('managerId', 'exists', 'validation.employee.manager')
    }
    const chain = id ? await employees.managerChain(input.managerId) : []
    if (id && chain.includes(id)) {
      throw new AppException('E_HIERARCHY_CYCLE', {
        details: [{ field: 'managerId', rule: 'cycle', message: 'validation.employee.cycle' }],
      })
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new EmployeeService()
