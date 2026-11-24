import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import TalentPolicy from '#policies/talent_policy'
import skillsMatrixService from '#modules/talents/services/skills_matrix_service'
import { skillsMatrixDto } from '#modules/talents/transformers/talent_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  skillsMatrixValidator,
  updateSkillsMatrixValidator,
} from '#modules/talents/validators/talent_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/talents/skills-matrix` (decision of 2026-11-24). */
export default class SkillsMatrixController {
  @ApiOperation({ summary: 'Skills matrix: employees by catalog skills' })
  async show(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(skillsMatrixValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('view')
    const { employees, skills, levels } = await skillsMatrixService.show(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      departmentId: query.filter?.departmentId,
      skillIds: query.filter?.skillId,
      status: query.filter?.status,
    })
    return {
      data: skillsMatrixDto(skills, employees.all(), levels),
      meta: pageMetaDto(employees.getMeta()),
    }
  }

  @ApiOperation({ summary: 'Set levels of the skills matrix (null removes)' })
  @ApiBody({ type: () => updateSkillsMatrixValidator })
  async update(ctx: HttpContext) {
    const { entries } = await ctx.request.validateUsing(updateSkillsMatrixValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('manage')
    const result = await skillsMatrixService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      entries,
      auditContext(ctx)
    )
    return ctx.serialize(result)
  }
}
