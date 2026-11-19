import type Contract from '#models/contract'
import type Department from '#models/department'
import type Employee from '#models/employee'
import type Skill from '#models/skill'
import type { EmployeeVisibility } from '#modules/hr/employee_visibility'
import type { EmployeeSkillRow } from '#modules/hr/repositories/skill_repository'

export function departmentDto(department: Department) {
  return {
    id: department.id,
    name: department.name,
    description: department.description,
    managerId: department.managerId,
    parentDepartmentId: department.parentDepartmentId,
    createdAt: department.createdAt.toISO(),
    updatedAt: department.updatedAt.toISO(),
  }
}

/** "Champs réduits" of docs/backend/04 §5. */
export function employeeReducedDto(employee: Employee) {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    jobTitle: employee.jobTitle,
    departmentId: employee.departmentId,
    photoUrl: employee.photoUrl,
  }
}

function employeeTeamDto(employee: Employee) {
  return {
    ...employeeReducedDto(employee),
    userId: employee.userId,
    employeeNumber: employee.employeeNumber,
    email: employee.email,
    phone: employee.phone,
    managerId: employee.managerId,
    hireDate: employee.hireDate?.toISODate() ?? null,
    endDate: employee.endDate?.toISODate() ?? null,
    status: employee.status,
    leaveBalance: Number(employee.leaveBalance),
    createdAt: employee.createdAt.toISO(),
    updatedAt: employee.updatedAt.toISO(),
  }
}

/**
 * Output for what the viewer may read. Salary and identity documents are in
 * none of these shapes: the salary has its own audited endpoint.
 */
export function employeeDto(employee: Employee, visibility: EmployeeVisibility) {
  if (visibility === 'reduced') return employeeReducedDto(employee)
  if (visibility === 'team') return employeeTeamDto(employee)
  return {
    ...employeeTeamDto(employee),
    birthDate: employee.birthDate?.toISODate() ?? null,
    address: employee.address,
    emergencyContact: employee.emergencyContact,
  }
}

export function employeeSalaryDto(employee: Employee) {
  return {
    baseSalary: employee.baseSalary === null ? null : Number(employee.baseSalary),
    salaryCurrency: employee.salaryCurrency,
  }
}

/**
 * `team` is what a manager reads: no salary (04 §5), and no free-text notes,
 * which may mention it. The storage path of the document is never returned.
 */
export function contractDto(contract: Contract, visibility: 'full' | 'team') {
  const base = {
    id: contract.id,
    employeeId: contract.employeeId,
    type: contract.type,
    status: contract.status,
    startDate: contract.startDate.toISODate(),
    endDate: contract.endDate?.toISODate() ?? null,
    trialPeriodEnd: contract.trialPeriodEnd?.toISODate() ?? null,
    weeklyHours: contract.weeklyHours === null ? null : Number(contract.weeklyHours),
    hasDocument: contract.documentPath !== null,
    createdAt: contract.createdAt.toISO(),
    updatedAt: contract.updatedAt.toISO(),
  }
  if (visibility === 'team') return base
  return {
    ...base,
    salary: contract.salary === null ? null : Number(contract.salary),
    currency: contract.currency,
    notes: contract.notes,
  }
}

export function skillDto(skill: Skill) {
  return {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    createdAt: skill.createdAt.toISO(),
    updatedAt: skill.updatedAt.toISO(),
  }
}

export function employeeSkillDto(row: EmployeeSkillRow) {
  return {
    skillId: row.skillId,
    name: row.name,
    category: row.category,
    level: row.level,
    assessedAt: row.assessedAt?.toISODate() ?? null,
  }
}

export function pageMetaDto(meta: {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}) {
  return {
    total: meta.total,
    perPage: meta.perPage,
    currentPage: meta.currentPage,
    lastPage: meta.lastPage,
  }
}
