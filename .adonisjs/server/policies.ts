export const policies = {
  DepartmentPolicy: () => import('#policies/department_policy'),
  EmployeePolicy: () => import('#policies/employee_policy'),
  InvitationPolicy: () => import('#policies/invitation_policy'),
  OrganizationPolicy: () => import('#policies/organization_policy'),
}

