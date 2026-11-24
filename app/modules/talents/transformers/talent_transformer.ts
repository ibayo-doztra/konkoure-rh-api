import type Employee from '#models/employee'
import type EmployeeSkill from '#models/employee_skill'
import type Skill from '#models/skill'
import type SuccessionPlan from '#models/succession_plan'

const person = (id: string | null, names: Map<string, string>) =>
  id === null ? null : { id, name: names.get(id) ?? null }

export function successionPlanDto(plan: SuccessionPlan, names: Map<string, string>) {
  return {
    id: plan.id,
    positionTitle: plan.positionTitle,
    currentEmployee: person(plan.currentEmployeeId, names),
    successorEmployee: person(plan.successorEmployeeId, names),
    readiness: plan.readiness,
    notes: plan.notes,
    createdAt: plan.createdAt.toISO(),
    updatedAt: plan.updatedAt.toISO(),
  }
}

/** Rows of the skills matrix: `levels` maps a skill id to its level (1..5). */
export function skillsMatrixDto(skills: Skill[], employees: Employee[], levels: EmployeeSkill[]) {
  const byEmployee = new Map<string, Record<string, number>>()
  for (const cell of levels) {
    const row = byEmployee.get(cell.employeeId) ?? {}
    row[cell.skillId] = cell.level
    byEmployee.set(cell.employeeId, row)
  }
  return {
    skills: skills.map((skill) => ({ id: skill.id, name: skill.name, category: skill.category })),
    employees: employees.map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      jobTitle: employee.jobTitle,
      departmentId: employee.departmentId,
      levels: byEmployee.get(employee.id) ?? {},
    })),
  }
}
