export const policies = {
  ContractPolicy: () => import('#policies/contract_policy'),
  DepartmentPolicy: () => import('#policies/department_policy'),
  EmployeePolicy: () => import('#policies/employee_policy'),
  InvitationPolicy: () => import('#policies/invitation_policy'),
  LeavePolicy: () => import('#policies/leave_policy'),
  OrganizationPolicy: () => import('#policies/organization_policy'),
  SkillPolicy: () => import('#policies/skill_policy'),
}

