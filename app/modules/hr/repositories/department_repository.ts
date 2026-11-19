import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Department from '#models/department'
import Employee from '#models/employee'
import { TenantRepository } from '#shared/base/tenant_repository'

const MAX_DEPTH = 10

/** Tenant-scoped department access; deleted departments are excluded by default. */
export class DepartmentRepository extends TenantRepository<typeof Department> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Department, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<Department>>) {
    return Department.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: { page: number; perPage: number }) {
    return this.query()
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  /** Every live department, for name resolution (import, export). */
  all() {
    return this.query().select('id', 'name').orderBy('name')
  }

  async nameTaken(name: string, exceptId?: string) {
    const query = this.query().whereRaw('lower(name) = lower(?)', [name])
    if (exceptId) query.whereNot('id', exceptId)
    return Boolean(await query.first())
  }

  /** The department followed by its successive parents. */
  async ancestry(id: string): Promise<string[]> {
    const chain: string[] = []
    let current: string | null = id
    while (current && chain.length <= MAX_DEPTH && !chain.includes(current)) {
      chain.push(current)
      const row: Department | null = await this.find(current)
      current = row?.parentDepartmentId ?? null
    }
    return chain
  }

  private employees() {
    return Employee.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereNull('deleted_at')
  }

  async hasEmployees(id: string) {
    return Boolean(await this.employees().where('department_id', id).first())
  }

  async moveEmployees(fromId: string, toId: string) {
    await this.employees().where('department_id', fromId).update({ department_id: toId })
  }

  async reparentChildren(id: string, parentId: string | null) {
    await this.query().where('parent_department_id', id).update({ parent_department_id: parentId })
  }

  /** A departing employee no longer heads any department. */
  async clearManager(employeeId: string) {
    await this.query().where('manager_id', employeeId).update({ manager_id: null })
  }
}

export function departmentsIn(organizationId: string, trx: TransactionClientContract) {
  return new DepartmentRepository(organizationId, trx)
}
