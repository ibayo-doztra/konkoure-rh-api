import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import SkillPolicy from '#policies/skill_policy'
import employeeService from '#modules/hr/services/employee_service'
import skillService from '#modules/hr/services/skill_service'
import { employeeSkillDto, pageMetaDto, skillDto } from '#modules/hr/transformers/hr_transformer'
import { employeeIdValidator, paginationValidator } from '#modules/hr/validators/employee_validator'
import {
  createSkillValidator,
  replaceEmployeeSkillsValidator,
  skillIdValidator,
  updateSkillValidator,
} from '#modules/hr/validators/skill_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/skills` and `/org/employees/:id/skills` (06-api-reference §5). */
export default class SkillsController {
  @ApiOperation({ summary: 'List the competency catalog' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(paginationValidator)
    await ctx.bouncer.with(SkillPolicy).authorize('viewCatalog')
    const page = await skillService.list(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    })
    return { data: page.all().map(skillDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Add a competency to the catalog' })
  @ApiBody({ type: () => createSkillValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createSkillValidator)
    await ctx.bouncer.with(SkillPolicy).authorize('manage')
    const skill = await skillService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(skillDto(skill))
  }

  @ApiOperation({ summary: 'Update a competency' })
  @ApiBody({ type: () => updateSkillValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateSkillValidator)
    await ctx.bouncer.with(SkillPolicy).authorize('manage')
    const skill = await skillService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(skillDto(skill))
  }

  @ApiOperation({ summary: 'Delete a competency and its assessments' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(skillIdValidator)
    await ctx.bouncer.with(SkillPolicy).authorize('manage')
    await skillService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Competencies of an employee' })
  async ofEmployee(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(employeeIdValidator)
    const { employee, inTeam } = await employeeService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(SkillPolicy).authorize('viewOfEmployee', employee, inTeam)
    const skills = await skillService.ofEmployee(ctx.tenant, employee.id)
    return { data: skills.map(employeeSkillDto) }
  }

  @ApiOperation({ summary: 'Replace the competencies of an employee' })
  @ApiBody({ type: () => replaceEmployeeSkillsValidator })
  async replaceOfEmployee(ctx: HttpContext) {
    const { params, skills } = await ctx.request.validateUsing(replaceEmployeeSkillsValidator)
    await ctx.bouncer.with(SkillPolicy).authorize('manage')
    const rows = await skillService.replaceForEmployee(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      skills,
      auditContext(ctx)
    )
    return { data: rows.map(employeeSkillDto) }
  }
}
