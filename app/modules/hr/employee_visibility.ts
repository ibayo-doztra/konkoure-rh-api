import type { TenantContext } from '#shared/tenant/tenant_context'

/**
 * What a viewer may read of an employee record (docs/backend/04 §5, 05 §5):
 * - `full`: owner, hr_admin and the employee themselves;
 * - `team`: a manager on their team, without personal data;
 * - `reduced`: recruiter and security agent (id, name, job, department, photo).
 */
export type EmployeeVisibility = 'full' | 'team' | 'reduced'

export function employeeVisibility(
  tenant: TenantContext,
  employee: { id: string },
  inTeam: boolean
): EmployeeVisibility | null {
  if (tenant.hasRole('owner', 'hr_admin') || tenant.employeeId === employee.id) return 'full'
  if (inTeam && tenant.hasRole('manager')) return 'team'
  return tenant.hasRole('recruiter', 'security_agent') ? 'reduced' : null
}
