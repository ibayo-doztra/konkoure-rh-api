import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'

/**
 * Employees whose punches and attendance the caller may read (04 §5): every
 * one for owner, hr_admin and security_agent (`undefined`), else the manager's
 * team and the caller's own record.
 */
export async function visibleEmployeeIds(
  tenant: TenantContext,
  trx: TransactionClientContract
): Promise<string[] | undefined> {
  if (tenant.hasRole('owner', 'hr_admin', 'security_agent')) return undefined
  const self = tenant.employeeId
  const team =
    tenant.hasRole('manager') && self
      ? await employeesIn(tenant.organizationId, trx).teamIds(self)
      : []
  return [...team, ...(self ? [self] : [])]
}
