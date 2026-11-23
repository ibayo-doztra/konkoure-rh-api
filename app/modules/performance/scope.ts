import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'

/**
 * Employees whose performance records the viewer reads (docs/backend/04 §5
 * "Performance"): `undefined` for everyone (owner, hr_admin), else the team
 * and self for a manager, self otherwise.
 */
export async function visibleEmployeeIds(
  tenant: TenantContext,
  trx: TransactionClientContract
): Promise<string[] | undefined> {
  if (tenant.hasRole('owner', 'hr_admin')) return undefined
  const self = tenant.employeeId
  const team =
    tenant.hasRole('manager') && self
      ? await employeesIn(tenant.organizationId, trx).teamIds(self)
      : []
  return [...team, ...(self ? [self] : [])]
}

/** The employee is a direct or indirect report of the viewer, who is a manager. */
export async function isInViewerTeam(
  tenant: TenantContext,
  trx: TransactionClientContract,
  employeeId: string | null
): Promise<boolean> {
  const self = tenant.employeeId
  if (self === null || employeeId === null || !tenant.hasRole('manager')) return false
  return employeesIn(tenant.organizationId, trx).isInTeamOf(self, employeeId)
}
