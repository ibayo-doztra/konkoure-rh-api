import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Contract from '#models/contract'
import type { ContractStatus, ContractType } from '#models/contract'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { contractsIn, type ContractRepository } from '#modules/hr/repositories/contract_repository'
import { employeesIn, type EmployeeRepository } from '#modules/hr/repositories/employee_repository'

export interface ContractInput {
  type?: ContractType
  status?: Exclude<ContractStatus, 'terminated'>
  startDate?: DateTime
  endDate?: DateTime | null
  trialPeriodEnd?: DateTime | null
  salary?: number | null
  currency?: string
  weeklyHours?: number | null
  notes?: string | null
}

export interface ContractListQuery {
  page?: number
  perPage?: number
  filter?: { employeeId?: string; status?: ContractStatus; type?: ContractType }
}

/** Signed links to private documents last 15 minutes (docs/backend/08 §6). */
const DOCUMENT_URL_TTL_SECONDS = 15 * 60

const conflict = (field: string, rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field, rule, message }] })

const decimal = (value: number | null | undefined) =>
  value === undefined || value === null ? value : String(value)

const day = (value: DateTime) => value.toISODate()!

function columns(input: ContractInput) {
  const values = {
    ...input,
    salary: decimal(input.salary),
    weeklyHours: decimal(input.weeklyHours),
  }
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as Omit<ContractInput, 'salary' | 'weeklyHours'> & {
    salary?: string | null
    weeklyHours?: string | null
  }
}

/** Contracts (docs/backend/06 §5, 07 §1.5). */
export class ContractService {
  /** Contracts the viewer may see; each read of salaries is journaled (05 §7). */
  list(tenant: TenantContext, query: ContractListQuery, audit: AuditContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const self = tenant.employeeId
      const hr = tenant.hasRole('owner', 'hr_admin')
      let employeeIds: string[] | undefined
      if (!hr) {
        const team =
          tenant.hasRole('manager') && self
            ? await employeesIn(organizationId, trx).teamIds(self)
            : []
        employeeIds = [...team, ...(self ? [self] : [])]
      }

      const page = await contractsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        employeeId: query.filter?.employeeId,
        status: query.filter?.status,
        type: query.filter?.type,
        employeeIds,
      })
      const rows = page.all().map((contract) => ({
        contract,
        visibility: hr || contract.employeeId === self ? ('full' as const) : ('team' as const),
      }))
      const contractIds = rows
        .filter((row) => row.visibility === 'full' && row.contract.salary !== null)
        .map((row) => row.contract.id)
      if (contractIds.length > 0) {
        await auditService.record(trx, this.context(tenant, audit), {
          action: 'salary.viewed',
          targetType: 'contract',
          after: { contractIds },
        })
      }
      return { rows, meta: page.getMeta() }
    })
  }

  find(tenant: TenantContext, id: string): Promise<Contract> {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => contractsIn(organizationId, trx).findOrFail(id))
  }

  /** HR detail, salary included: the read is journaled when there is one. */
  show(tenant: TenantContext, id: string, audit: AuditContext): Promise<Contract> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const contract = await contractsIn(organizationId, trx).findOrFail(id)
      if (contract.salary !== null) {
        await auditService.record(trx, this.context(tenant, audit), {
          action: 'salary.viewed',
          targetType: 'contract',
          targetId: id,
        })
      }
      return contract
    })
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: ContractInput & { employeeId: string; type: ContractType; startDate: DateTime },
    audit: AuditContext
  ): Promise<Contract> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      const contracts = contractsIn(organizationId, trx)
      await employees.lockHierarchy()
      this.assertDates(input.startDate, input.endDate, input.trialPeriodEnd)
      if (!(await employees.find(input.employeeId))) {
        throw AppException.validation('employeeId', 'exists', 'validation.contract.employee')
      }
      if (input.status === 'active') {
        await this.assertCanActivate(employees, contracts, input.employeeId)
      }

      const { employeeId, ...fields } = input
      const contract = await contracts.create({
        ...columns(fields),
        employeeId,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'contract.created',
        targetType: 'contract',
        targetId: contract.id,
        after: { employeeId, type: input.type, status: input.status ?? 'draft' },
      })
      await contract.refresh()
      return contract
    })
  }

  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: ContractInput,
    audit: AuditContext
  ): Promise<Contract> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const employees = employeesIn(organizationId, trx)
      const contracts = contractsIn(organizationId, trx)
      await employees.lockHierarchy()
      const contract = await contracts.findForUpdate(id)
      if (!contract) throw new AppException('E_NOT_FOUND')
      if (contract.status === 'terminated') {
        throw conflict('status', 'terminated', 'validation.contract.terminated')
      }

      this.assertDates(
        input.startDate ?? contract.startDate,
        input.endDate === undefined ? contract.endDate : input.endDate,
        input.trialPeriodEnd === undefined ? contract.trialPeriodEnd : input.trialPeriodEnd
      )
      if (input.status === 'active' && contract.status !== 'active') {
        await this.assertCanActivate(employees, contracts, contract.employeeId)
      }

      const changes = columns(input)
      const before = { status: contract.status }
      contract.merge({ ...changes, updatedBy: actor.id })
      await contracts.save(contract)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'contract.updated',
        targetType: 'contract',
        targetId: id,
        before,
        after: { status: contract.status, changedFields: Object.keys(changes) },
      })
      await contract.refresh()
      return contract
    })
  }

  terminate(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: { endDate?: DateTime },
    audit: AuditContext
  ): Promise<Contract> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const contracts = contractsIn(organizationId, trx)
      await employeesIn(organizationId, trx).lockHierarchy()
      const contract = await contracts.findForUpdate(id)
      if (!contract) throw new AppException('E_NOT_FOUND')
      if (contract.status !== 'active' && contract.status !== 'suspended') {
        throw conflict('status', 'notTerminable', 'validation.contract.notTerminable')
      }

      let endDate = input.endDate
      if (endDate) {
        this.assertDates(contract.startDate, endDate, null)
      } else {
        const organization = await organizations.findActive(organizationId, trx)
        if (!organization) throw new AppException('E_NOT_FOUND')
        endDate = this.closingDate(contract, DateTime.now().setZone(organization.timezone))
      }
      await this.close(trx, tenant, actor, contracts, contract, endDate, audit)
      await contract.refresh()
      return contract
    })
  }

  /** End of employment (07 §1.5), inside the transaction of the employee update. */
  async closeActiveOf(
    trx: TransactionClientContract,
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    date: DateTime,
    audit: AuditContext
  ) {
    const contracts = contractsIn(tenant.organizationId, trx)
    const contract = await contracts.activeOfForUpdate(employeeId)
    if (!contract) return
    const endDate = this.closingDate(contract, date)
    await this.close(trx, tenant, actor, contracts, contract, endDate, audit)
  }

  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const contracts = contractsIn(organizationId, trx)
      await employeesIn(organizationId, trx).lockHierarchy()
      const contract = await contracts.findForUpdate(id)
      if (!contract) throw new AppException('E_NOT_FOUND')

      const before = { status: contract.status, employeeId: contract.employeeId }
      contract.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await contracts.save(contract)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'contract.deleted',
        targetType: 'contract',
        targetId: id,
        before,
      })
    })
  }

  /** Short-lived link to the private file; the storage call stays out of the transaction. */
  async documentUrl(tenant: TenantContext, contract: Contract, audit: AuditContext) {
    const path = contract.documentPath
    if (!path) throw new AppException('E_NOT_FOUND')
    await withTenant(tenant.organizationId, (trx) =>
      auditService.record(trx, this.context(tenant, audit), {
        action: 'sensitive_document.viewed',
        targetType: 'contract',
        targetId: contract.id,
      })
    )
    try {
      const url = await drive
        .use('s3')
        .getSignedUrl(path, { expiresIn: `${DOCUMENT_URL_TTL_SECONDS}s` })
      return { url, expiresIn: DOCUMENT_URL_TTL_SECONDS }
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
  }

  private async close(
    trx: TransactionClientContract,
    tenant: TenantContext,
    actor: User,
    contracts: ContractRepository,
    contract: Contract,
    endDate: DateTime,
    audit: AuditContext
  ) {
    const before = { status: contract.status }
    contract.merge({ status: 'terminated', endDate, updatedBy: actor.id })
    await contracts.save(contract)
    await auditService.record(trx, this.context(tenant, audit), {
      action: 'contract.terminated',
      targetType: 'contract',
      targetId: contract.id,
      before,
      after: { status: 'terminated', endDate: day(endDate) },
    })
  }

  /** An earlier planned end is kept; the end never precedes the start. */
  private closingDate(contract: Contract, date: DateTime) {
    const planned = contract.endDate
    const end = planned && day(planned) < day(date) ? planned : date
    return day(end) < day(contract.startDate) ? contract.startDate : end
  }

  private assertDates(start: DateTime, end?: DateTime | null, trialEnd?: DateTime | null) {
    if (end && day(end) < day(start)) {
      throw AppException.validation('endDate', 'afterStart', 'validation.contract.endDate')
    }
    if (trialEnd && (day(trialEnd) < day(start) || (end && day(trialEnd) > day(end)))) {
      throw AppException.validation(
        'trialPeriodEnd',
        'withinContract',
        'validation.contract.trialPeriodEnd'
      )
    }
  }

  /** One active contract per employee (02 §4), none for a former employee. */
  private async assertCanActivate(
    employees: EmployeeRepository,
    contracts: ContractRepository,
    employeeId: string
  ) {
    const employee = await employees.find(employeeId)
    if (employee?.status === 'terminated') {
      throw conflict('status', 'employeeTerminated', 'validation.contract.employeeTerminated')
    }
    if (await contracts.activeOfForUpdate(employeeId)) {
      throw conflict('status', 'activeExists', 'validation.contract.activeExists')
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new ContractService()
