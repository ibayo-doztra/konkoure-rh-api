export const policies = {
  BillingPolicy: () => import('#policies/billing_policy'),
  ContractPolicy: () => import('#policies/contract_policy'),
  DashboardPolicy: () => import('#policies/dashboard_policy'),
  DepartmentPolicy: () => import('#policies/department_policy'),
  EmployeePolicy: () => import('#policies/employee_policy'),
  IntegrationPolicy: () => import('#policies/integration_policy'),
  InvitationPolicy: () => import('#policies/invitation_policy'),
  LeavePolicy: () => import('#policies/leave_policy'),
  OrganizationPolicy: () => import('#policies/organization_policy'),
  PerformancePolicy: () => import('#policies/performance_policy'),
  PlatformPolicy: () => import('#policies/platform_policy'),
  RecruitmentPolicy: () => import('#policies/recruitment_policy'),
  SkillPolicy: () => import('#policies/skill_policy'),
  TalentPolicy: () => import('#policies/talent_policy'),
  TimeclockPolicy: () => import('#policies/timeclock_policy'),
}

