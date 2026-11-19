import { DateTime } from 'luxon'
import type User from '#models/user'
import type Department from '#models/department'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import teamCache from '#modules/hr/team_cache'
import type { TenantContext } from '#shared/tenant/tenant_context'
import {
  departmentsIn,
  type DepartmentRepository,
} from '#modules/hr/repositories/department_repository'
import { employeesIn, type EmployeeRepository } from '#modules/hr/repositories/employee_repository'

export interface DepartmentInput {
  name?: string
  description?: string | null
  managerId?: string | null
  parentDepartmentId?: string | null
}

function defined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/** Departments (docs/backend/06 §5). */
export class DepartmentService {
  list(tenant: TenantContext, filters: { page: number; perPage: number }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => departmentsIn(organizationId, trx).paginate(filters))
  }

  find(tenant: TenantContext, id: string): Promise<Department> {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => departmentsIn(organizationId, trx).findOrFail(id))
  }

  async create(
    tenant: TenantContext,
    actor: User,
    input: DepartmentInput & { name: string },
    audit: AuditContext
  ): Promise<Department> {
    const { organizationId } = tenant
    const result = await withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      const departments = departmentsIn(organizationId, trx)
      await employees.lockHierarchy()
      await this.assertValid(departments, employees, input)

      const department = await departments.create({
        ...defined(input),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'department.created',
        targetType: 'department',
        targetId: department.id,
        after: { name: department.name },
      })
      await department.refresh()
      return department
    })
    await teamCache.invalidate(organizationId)
    return result
  }

  async update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: DepartmentInput,
    audit: AuditContext
  ): Promise<Department> {
    const { organizationId } = tenant
    const result = await withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      const departments = departmentsIn(organizationId, trx)
      await employees.lockHierarchy()
      const department = await departments.findForUpdate(id)
      if (!department) throw new AppException('E_NOT_FOUND')
      await this.assertValid(departments, employees, input, id)

      const changes = defined(input)
      const before = Object.fromEntries(
        Object.keys(changes).map((key) => [key, department[key as keyof DepartmentInput]])
      )
      department.merge({ ...changes, updatedBy: actor.id })
      await departments.save(department)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'department.updated',
        targetType: 'department',
        targetId: department.id,
        before,
        after: changes,
      })
      await department.refresh()
      return department
    })
    await teamCache.invalidate(organizationId)
    return result
  }

  /** Soft delete; employees must move first, sub-departments go up one level. */
  async remove(
    tenant: TenantContext,
    actor: User,
    id: string,
    reassignTo: string | undefined,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const departments = departmentsIn(organizationId, trx)
      await employeesIn(organizationId, trx).lockHierarchy()
      const department = await departments.findForUpdate(id)
      if (!department) throw new AppException('E_NOT_FOUND')

      if (reassignTo) {
        if (reassignTo === id || !(await departments.find(reassignTo))) {
          throw AppException.validation('reassignTo', 'exists', 'validation.department.reassignTo')
        }
        await departments.moveEmployees(id, reassignTo)
      } else if (await departments.hasEmployees(id)) {
        throw new AppException('E_CONFLICT', {
          details: [
            { field: 'id', rule: 'hasEmployees', message: 'validation.department.hasEmployees' },
          ],
        })
      }

      await departments.reparentChildren(id, department.parentDepartmentId)
      department.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await departments.save(department)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'department.deleted',
        targetType: 'department',
        targetId: id,
        before: { name: department.name },
        after: { reassignTo: reassignTo ?? null },
      })
    })
    await teamCache.invalidate(organizationId)
  }

  /** Client-supplied ids are re-read inside the organization (05 §2). */
  private async assertValid(
    departments: DepartmentRepository,
    employees: EmployeeRepository,
    input: DepartmentInput,
    id?: string
  ) {
    if (input.name && (await departments.nameTaken(input.name, id))) {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'name', rule: 'taken', message: 'validation.department.nameTaken' }],
      })
    }
    if (input.managerId && !(await employees.find(input.managerId))) {
      throw AppException.validation('managerId', 'exists', 'validation.department.manager')
    }
    if (!input.parentDepartmentId) return
    if (!(await departments.find(input.parentDepartmentId))) {
      throw AppException.validation('parentDepartmentId', 'exists', 'validation.department.parent')
    }
    const ancestry = id ? await departments.ancestry(input.parentDepartmentId) : []
    if (id && ancestry.includes(id)) {
      throw new AppException('E_HIERARCHY_CYCLE', {
        details: [
          { field: 'parentDepartmentId', rule: 'cycle', message: 'validation.department.cycle' },
        ],
      })
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new DepartmentService()
