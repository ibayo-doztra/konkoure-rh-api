import type { AppRole } from '#models/user_role'

/**
 * Organization a request acts on, resolved by the tenant middleware
 * (docs/backend/01 §4). Permissions are the union of the roles held (04 §5).
 */
export class TenantContext {
  constructor(
    readonly organizationId: string,
    readonly roles: readonly AppRole[],
    /** Employee record linked to the user in this organization (HR module). */
    readonly employeeId: string | null = null
  ) {}

  hasRole(...roles: AppRole[]): boolean {
    return roles.some((role) => this.roles.includes(role))
  }

  /** Main role written to audit rows: the most privileged one held. */
  get primaryRole(): AppRole | null {
    const order: AppRole[] = [
      'owner',
      'hr_admin',
      'manager',
      'recruiter',
      'security_agent',
      'employee',
    ]
    return order.find((role) => this.roles.includes(role)) ?? null
  }
}
