import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import type { ContractType } from '#models/contract'
import Employee, { type EmployeeStatus } from '#models/employee'
import { TenantRepository } from '#shared/base/tenant_repository'
import { withTenant } from '#shared/tenant/with_tenant'

/** Guard against cycles and runaway chains (docs/backend/04 §6, 07 §1.3). */
const MAX_HIERARCHY_DEPTH = 10

const SORTABLE = { last_name: 'last_name', hire_date: 'hire_date', created_at: 'created_at' }
export type EmployeeSortField = keyof typeof SORTABLE

export interface EmployeeListFilters {
  page: number
  perPage: number
  q?: string
  /** Search e-mail and employee number too, for viewers allowed to read them. */
  searchPrivateFields: boolean
  status?: EmployeeStatus
  departmentId?: string
  managerId?: string
  /** Type of the employee's active contract. */
  contractType?: ContractType
  sort?: EmployeeSortField
  descending?: boolean
  /** Restricts the list to these records (team, self). */
  ids?: string[]
}

const likePattern = (value: string) =>
  `%${value.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** Tenant-scoped employee access; deleted records are excluded by default. */
export class EmployeeRepository extends TenantRepository<typeof Employee> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Employee, organizationId, trx)
  }

  /**
   * Serializes quota, uniqueness and hierarchy checks within the organization,
   * without blocking the inserts that reference its row.
   */
  async lockHierarchy() {
    await this.trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
      `hr:${this.organizationId}`,
    ])
  }

  create(data: Partial<ModelAttributes<Employee>>) {
    return Employee.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  findDeletedForUpdate(id: string) {
    return Employee.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('id', id)
      .whereNotNull('deleted_at')
      .forUpdate()
      .first()
  }

  findByUser(userId: string) {
    return this.query().where('user_id', userId).first()
  }

  async emailTaken(email: string, exceptId?: string) {
    const query = this.query().where('email', email)
    if (exceptId) query.whereNot('id', exceptId)
    return Boolean(await query.first())
  }

  /** The unique constraint also covers deleted records (02 §4). */
  async numberTaken(employeeNumber: string, exceptId?: string) {
    const query = Employee.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('employee_number', employeeNumber)
    if (exceptId) query.whereNot('id', exceptId)
    return Boolean(await query.first())
  }

  /** Records counted against the plan quota (07 §1.1). */
  async headcount() {
    const row = await this.query().whereNot('status', 'terminated').count('* as total').first()
    return Number(row?.$extras.total ?? 0)
  }

  paginate(filters: EmployeeListFilters) {
    const query = this.query()
    if (filters.ids) query.whereIn('id', filters.ids)
    if (filters.status) query.where('status', filters.status)
    if (filters.departmentId) query.where('department_id', filters.departmentId)
    if (filters.managerId) query.where('manager_id', filters.managerId)
    if (filters.contractType) {
      query.whereIn(
        'id',
        this.trx
          .from('contracts')
          .where('organization_id', this.organizationId)
          .where('type', filters.contractType)
          .where('status', 'active')
          .whereNull('deleted_at')
          .select('employee_id')
      )
    }
    if (filters.q) {
      const pattern = likePattern(filters.q)
      query.where((search) => {
        search.whereRaw(`lower(first_name || ' ' || last_name) like ?`, [pattern])
        if (filters.searchPrivateFields) {
          search.orWhereRaw('lower(email::text) like ?', [pattern])
          search.orWhereRaw('lower(employee_number) like ?', [pattern])
        }
      })
    }

    const direction = filters.descending ? 'desc' : 'asc'
    query.orderBy(SORTABLE[filters.sort ?? 'last_name'], direction)
    if (!filters.sort || filters.sort === 'last_name') query.orderBy('first_name', direction)
    return query.orderBy('id', 'asc').paginate(filters.page, filters.perPage)
  }

  /** Active department heads, existing supervisors and `manager` role holders (07 §1.4). */
  eligibleManagers(filters: { page: number; perPage: number }) {
    const scoped = (table: string) =>
      this.trx.from(table).where('organization_id', this.organizationId)
    return this.query()
      .where('status', 'active')
      .where((eligible) => {
        eligible
          .whereIn(
            'id',
            scoped('departments')
              .whereNull('deleted_at')
              .whereNotNull('manager_id')
              .select('manager_id')
          )
          .orWhereIn(
            'id',
            scoped('employees')
              .whereNull('deleted_at')
              .whereNotNull('manager_id')
              .select('manager_id')
          )
          .orWhereIn('user_id', scoped('user_roles').where('role', 'manager').select('user_id'))
      })
      .orderBy('last_name', 'asc')
      .orderBy('first_name', 'asc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  /** Direct and indirect reports of a manager. */
  async teamIds(managerId: string): Promise<string[]> {
    const { rows } = await this.trx.rawQuery(
      `WITH RECURSIVE team AS (
         SELECT id, 1 AS depth FROM employees
          WHERE organization_id = ? AND manager_id = ? AND deleted_at IS NULL
         UNION
         SELECT e.id, t.depth + 1 FROM employees e
           JOIN team t ON e.manager_id = t.id
          WHERE e.organization_id = ? AND e.deleted_at IS NULL AND t.depth < ?
       ) SELECT DISTINCT id FROM team`,
      [this.organizationId, managerId, this.organizationId, MAX_HIERARCHY_DEPTH]
    )
    return (rows as Array<{ id: string }>).map((row) => row.id).filter((id) => id !== managerId)
  }

  /** The employee followed by their successive managers. */
  async managerChain(employeeId: string): Promise<string[]> {
    const { rows } = await this.trx.rawQuery(
      `WITH RECURSIVE chain AS (
         SELECT id, manager_id, 0 AS depth FROM employees
          WHERE organization_id = ? AND id = ? AND deleted_at IS NULL
         UNION
         SELECT e.id, e.manager_id, c.depth + 1 FROM employees e
           JOIN chain c ON e.id = c.manager_id
          WHERE e.organization_id = ? AND e.deleted_at IS NULL AND c.depth < ?
       ) SELECT id FROM chain ORDER BY depth`,
      [this.organizationId, employeeId, this.organizationId, MAX_HIERARCHY_DEPTH]
    )
    return (rows as Array<{ id: string }>).map((row) => row.id)
  }

  async isInTeamOf(managerId: string, employeeId: string) {
    if (managerId === employeeId) return false
    const chain = await this.managerChain(employeeId)
    return chain.includes(managerId)
  }

  /** First and last names of live employee records, by id. */
  async namesOf(ids: string[]) {
    if (ids.length === 0) return new Map<string, string>()
    const rows = await this.query().whereIn('id', ids).select('id', 'first_name', 'last_name')
    return new Map(rows.map((row) => [row.id, `${row.firstName} ${row.lastName}`]))
  }

  /** Moves the listed employees from `from` to `to`, leaving any other status alone. */
  async switchStatus(ids: string[], from: EmployeeStatus, to: EmployeeStatus) {
    if (ids.length === 0) return 0
    const changed = await this.query()
      .whereIn('id', ids)
      .where('status', from)
      .update({ status: to })
    return Array.isArray(changed) ? Number(changed[0] ?? 0) : Number(changed)
  }

  /** Cache of the current-year annual leave balance (docs/backend/07 §3.6). */
  async setLeaveBalance(employeeId: string, days: number) {
    await this.query()
      .where('id', employeeId)
      .update({ leave_balance: days.toFixed(2) })
  }

  /** Attaches the direct reports of a departing manager to `managerId`. */
  async reassignReports(fromId: string, managerId: string | null) {
    await this.query().where('manager_id', fromId).update({ manager_id: managerId })
  }
}

export function employeesIn(organizationId: string, trx: TransactionClientContract) {
  return new EmployeeRepository(organizationId, trx)
}

/** Employee record linked to a user in an organization, if any. */
export function employeeOfUser(organizationId: string, userId: string) {
  return withTenant(organizationId, (trx) => employeesIn(organizationId, trx).findByUser(userId))
}
