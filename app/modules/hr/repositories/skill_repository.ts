import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import EmployeeSkill from '#models/employee_skill'
import Skill from '#models/skill'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface EmployeeSkillRow {
  skillId: string
  name: string
  category: string | null
  level: number
  assessedAt: DateTime | null
}

export interface EmployeeSkillInput {
  skillId: string
  level: number
  assessedAt?: DateTime | null
}

/** Tenant-scoped competency catalog and employee assessments. */
export class SkillRepository extends TenantRepository<typeof Skill> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Skill, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<Skill>>) {
    return Skill.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: { page: number; perPage: number }) {
    return this.query()
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  async nameTaken(name: string, exceptId?: string) {
    const query = this.query().whereRaw('lower(name) = lower(?)', [name])
    if (exceptId) query.whereNot('id', exceptId)
    return Boolean(await query.first())
  }

  async existingIds(ids: string[]) {
    const rows = await this.query().whereIn('id', ids).select('id')
    return new Set(rows.map((row) => row.id))
  }

  /** Assessments of this skill go with it (foreign key cascade). */
  async remove(skill: Skill) {
    skill.useTransaction(this.trx)
    await skill.delete()
  }

  private assessments() {
    return EmployeeSkill.query({ client: this.trx }).where(
      'employee_skills.organization_id',
      this.organizationId
    )
  }

  async assignedCount(skillId: string) {
    const row = await this.assessments().where('skill_id', skillId).count('* as total').first()
    return Number(row?.$extras.total ?? 0)
  }

  async ofEmployee(employeeId: string): Promise<EmployeeSkillRow[]> {
    const rows = await this.assessments()
      .join('skills', 'skills.id', 'employee_skills.skill_id')
      .where('employee_skills.employee_id', employeeId)
      .select('employee_skills.*', 'skills.name as skill_name', 'skills.category as skill_category')
      .orderBy('skills.name', 'asc')
    return rows.map((row) => ({
      skillId: row.skillId,
      name: row.$extras.skill_name,
      category: row.$extras.skill_category,
      level: row.level,
      assessedAt: row.assessedAt,
    }))
  }

  async replaceForEmployee(employeeId: string, items: EmployeeSkillInput[], actorId: string) {
    await this.assessments().where('employee_id', employeeId).delete()
    await EmployeeSkill.createMany(
      items.map((item) => ({
        organizationId: this.organizationId,
        employeeId,
        skillId: item.skillId,
        level: item.level,
        assessedAt: item.assessedAt ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })),
      { client: this.trx }
    )
  }
}

export function skillsIn(organizationId: string, trx: TransactionClientContract) {
  return new SkillRepository(organizationId, trx)
}
