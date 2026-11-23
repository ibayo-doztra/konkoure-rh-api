export const policies = {
  ContractPolicy: () => import('#policies/contract_policy'),
  DashboardPolicy: () => import('#policies/dashboard_policy'),
  DepartmentPolicy: () => import('#policies/department_policy'),
  EmployeePolicy: () => import('#policies/employee_policy'),
  InvitationPolicy: () => import('#policies/invitation_policy'),
  LeavePolicy: () => import('#policies/leave_policy'),
  OrganizationPolicy: () => import('#policies/organization_policy'),
  PerformancePolicy: () => import('#policies/performance_policy'),
  RecruitmentPolicy: () => import('#policies/recruitment_policy'),
  SkillPolicy: () => import('#policies/skill_policy'),
  TimeclockPolicy: () => import('#policies/timeclock_policy'),
}

