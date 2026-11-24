import type User from '#models/user'
import type { EmployeeStatus } from '#models/employee'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { skillsIn } from '#modules/hr/repositories/skill_repository'
import { visibleEmployeeIds } from '#modules/performance/scope'

export interface SkillsMatrixFilters {
  page: number
  perPage: number
  departmentId?: string
  skillIds?: string[]
  status?: EmployeeStatus
}

export interface SkillsMatrixEntry {
  employeeId: string
  skillId: string
  level: number | null
}

const cellKey = (employeeId: string, skillId: string) => `${employeeId}:${skillId}`

/**
 * Skills matrix of the talents module (decision of 2026-11-24): employees as
 * rows, catalog skills as columns, levels of `employee_skills` as cells.
 */
export class SkillsMatrixService {
  /** Owner and hr_admin see everyone, a manager their team (04 §5 "talents"). */
  show(tenant: TenantContext, filters: SkillsMatrixFilters) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const ids = await visibleEmployeeIds(tenant, trx)
      const scope = ids && tenant.employeeId ? ids.filter((id) => id !== tenant.employeeId) : ids
      const employees = await employeesIn(organizationId, trx).paginate({
        page: filters.page,
        perPage: filters.perPage,
        searchPrivateFields: false,
        ids: scope,
        departmentId: filters.departmentId,
        status: filters.status,
        excludeTerminated: !filters.status,
      })
      const skillRepository = skillsIn(organizationId, trx)
      const skills = await skillRepository.list(filters.skillIds)
      const rows = employees.all()
      const levels = await skillRepository.levelsOf(
        rows.map((row) => row.id),
        filters.skillIds
      )
      return { employees, skills, levels }
    })
  }

  /** Applies each cell: a level creates or updates the assessment, `null` removes it. */
  update(tenant: TenantContext, actor: User, entries: SkillsMatrixEntry[], audit: AuditContext) {
    const { organizationId } = tenant
    const keys = new Set(entries.map((entry) => cellKey(entry.employeeId, entry.skillId)))
    if (keys.size !== entries.length) {
      throw AppException.validation('entries', 'distinct', 'validation.skillsMatrix.duplicate')
    }

    return withTenant(organizationId, async (trx) => {
      const skills = skillsIn(organizationId, trx)
      const employeeIds = [...new Set(entries.map((entry) => entry.employeeId))]
      const skillIds = [...new Set(entries.map((entry) => entry.skillId))]
      const knownEmployees = await employeesIn(organizationId, trx).namesOf(employeeIds)
      if (employeeIds.some((id) => !knownEmployees.has(id))) {
        throw AppException.validation('entries', 'exists', 'validation.employee.notFound')
      }
      const knownSkills = await skills.existingIds(skillIds)
      if (skillIds.some((id) => !knownSkills.has(id))) {
        throw AppException.validation('entries', 'exists', 'validation.skill.unknown')
      }

      const current = await skills.lockCells(entries)
      const before = new Map(
        current.map((row) => [cellKey(row.employeeId, row.skillId), row.level])
      )
      const changes = entries.filter(
        (entry) => (before.get(cellKey(entry.employeeId, entry.skillId)) ?? null) !== entry.level
      )
      const upserts = changes.flatMap((entry) =>
        entry.level === null ? [] : [{ ...entry, level: entry.level }]
      )
      await skills.upsertLevels(upserts, actor.id)
      await skills.removeCells(changes.filter((entry) => entry.level === null))

      if (changes.length > 0) {
        await auditService.record(
          trx,
          { ...audit, organizationId, actorRole: tenant.primaryRole },
          {
            action: 'talents.skills_matrix_updated',
            targetType: 'organization',
            targetId: organizationId,
            after: {
              cells: changes.map((entry) => ({
                employeeId: entry.employeeId,
                skillId: entry.skillId,
                before: before.get(cellKey(entry.employeeId, entry.skillId)) ?? null,
                level: entry.level,
              })),
            },
          }
        )
      }
      return { updated: upserts.length, removed: changes.length - upserts.length }
    })
  }
}

export default new SkillsMatrixService()
