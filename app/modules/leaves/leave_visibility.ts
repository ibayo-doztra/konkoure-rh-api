import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'

/**
 * Employees whose leaves and balances the viewer reads (docs/backend/04 §5
 * "Congés"): `undefined` for everyone (owner, hr_admin), else the team and
 * self for a manager, self otherwise.
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
