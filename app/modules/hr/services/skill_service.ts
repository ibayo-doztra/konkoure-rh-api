import type User from '#models/user'
import type Skill from '#models/skill'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import {
  skillsIn,
  type EmployeeSkillInput,
  type SkillRepository,
} from '#modules/hr/repositories/skill_repository'

export interface SkillInput {
  name?: string
  category?: string | null
}

/** Competency catalog and employee assessments (docs/backend/06 §5). */
export class SkillService {
  list(tenant: TenantContext, filters: { page: number; perPage: number }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => skillsIn(organizationId, trx).paginate(filters))
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: SkillInput & { name: string },
    audit: AuditContext
  ): Promise<Skill> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const skills = skillsIn(organizationId, trx)
      await employeesIn(organizationId, trx).lockHierarchy()
      await this.assertNameFree(skills, input.name)
      const skill = await skills.create({ ...input, createdBy: actor.id, updatedBy: actor.id })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'skill.created',
        targetType: 'skill',
        targetId: skill.id,
        after: { name: skill.name, category: input.category ?? null },
      })
      await skill.refresh()
      return skill
    })
  }

  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: SkillInput,
    audit: AuditContext
  ): Promise<Skill> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const skills = skillsIn(organizationId, trx)
      await employeesIn(organizationId, trx).lockHierarchy()
      const skill = await skills.findForUpdate(id)
      if (!skill) throw new AppException('E_NOT_FOUND')
      if (input.name) await this.assertNameFree(skills, input.name, id)

      const before = { name: skill.name, category: skill.category }
      if (input.name !== undefined) skill.name = input.name
      if (input.category !== undefined) skill.category = input.category
      skill.updatedBy = actor.id
      await skills.save(skill)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'skill.updated',
        targetType: 'skill',
        targetId: id,
        before,
        after: { name: skill.name, category: skill.category },
      })
      await skill.refresh()
      return skill
    })
  }

  /** The catalog has no soft delete: assessments of the skill are removed with it. */
  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const skills = skillsIn(organizationId, trx)
      const skill = await skills.findForUpdate(id)
      if (!skill) throw new AppException('E_NOT_FOUND')

      const assessments = await skills.assignedCount(id)
      await skills.remove(skill)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'skill.deleted',
        targetType: 'skill',
        targetId: id,
        before: { name: skill.name, category: skill.category, assessments },
      })
    })
  }

  ofEmployee(tenant: TenantContext, employeeId: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => skillsIn(organizationId, trx).ofEmployee(employeeId))
  }

  /** PUT semantics: the list sent becomes the employee's whole set of skills. */
  replaceForEmployee(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    items: EmployeeSkillInput[],
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const skills = skillsIn(organizationId, trx)
      const employee = await employeesIn(organizationId, trx).findForUpdate(employeeId)
      if (!employee) throw new AppException('E_NOT_FOUND')

      const known = await skills.existingIds(items.map((item) => item.skillId))
      if (items.some((item) => !known.has(item.skillId))) {
        throw AppException.validation('skills', 'exists', 'validation.skill.unknown')
      }
      await skills.replaceForEmployee(employeeId, items, actor.id)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'employee.skills_updated',
        targetType: 'employee',
        targetId: employeeId,
        after: { skills: items.map(({ skillId, level }) => ({ skillId, level })) },
      })
      return skills.ofEmployee(employeeId)
    })
  }

  private async assertNameFree(skills: SkillRepository, name: string, id?: string) {
    if (await skills.nameTaken(name, id)) {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'name', rule: 'taken', message: 'validation.skill.nameTaken' }],
      })
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new SkillService()
