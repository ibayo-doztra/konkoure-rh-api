import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import PerformancePolicy from '#policies/performance_policy'
import { AppException } from '#shared/exceptions/app_exception'
import okrService from '#modules/performance/services/okr_service'
import aiService from '#modules/integrations/services/ai_service'
import { okrSuggestTask } from '#modules/integrations/prompts/okr_suggest'
import { okrCheckinDto, okrDto } from '#modules/performance/transformers/performance_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  createCheckinValidator,
  createOkrValidator,
  suggestOkrValidator,
  idValidator,
  listOkrsValidator,
  replaceKeyResultsValidator,
  requestRevisionValidator,
  updateKeyResultValidator,
  updateOkrValidator,
  validateOkrValidator,
} from '#modules/performance/validators/performance_validator'
import { auditContext } from '#modules/auth/http_helpers'

type View = Awaited<ReturnType<typeof okrService.view>>
const viewDto = (view: View) => okrDto(view.okr, view.keyResults)

/** `/api/v1/org/performance/okrs` (06-api-reference §9, 07 §5.3 to §5.6). */
export default class OkrsController {
  @ApiOperation({ summary: 'List the OKRs visible to the caller, with their key results' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listOkrsValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('read')
    const { rows, keyResults, meta } = await okrService.list(ctx.tenant, query)
    return { data: rows.map((okr) => okrDto(okr, keyResults)), meta: pageMetaDto(meta) }
  }

  /** `POST /okrs/suggest` (06 §9): AI key results, one credit, nothing stored. */
  @ApiOperation({ summary: 'AI suggestion of key results' })
  @ApiBody({ type: () => suggestOkrValidator })
  async suggest(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(suggestOkrValidator)
    await ctx.bouncer.with(PerformancePolicy).authorize('suggestOkr')
    const user = ctx.auth.getUserOrFail()
    const result = await aiService.run(
      okrSuggestTask({
        objective: input.objective,
        context: input.context,
        count: input.count ?? 3,
        language: user.preferredLanguage === 'en' ? 'en' : 'fr',
      }),
      {
        organizationId: ctx.tenant.organizationId,
        userId: user.id,
        module: 'performance',
        path: '/org/performance/okrs/suggest',
      }
    )
    return ctx.serialize(result)
  }

  @ApiOperation({ summary: 'Create a draft OKR' })
  @ApiBody({ type: () => createOkrValidator })
  async store(ctx: HttpContext) {
    const { employeeId, ...input } = await ctx.request.validateUsing(createOkrValidator)
    const holder = employeeId ?? ctx.tenant.employeeId
    if (!holder) {
      throw AppException.validation('employeeId', 'required', 'validation.performance.holder')
    }
    const inTeam = await okrService.inTeam(ctx.tenant, holder)
    await ctx.bouncer.with(PerformancePolicy).authorize('createOkr', holder, inTeam)
    const view = await okrService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      holder,
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'OKR detail with its key results' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewOkr', okr, inTeam)
    return ctx.serialize(viewDto(await okrService.view(ctx.tenant, okr)))
  }

  @ApiOperation({ summary: 'Update the objective or quarter (draft, needs_revision)' })
  @ApiBody({ type: () => updateOkrValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateOkrValidator)
    const { okr } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('editOkr', okr)
    const view = await okrService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'Delete an OKR (soft delete)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { okr } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('editOkr', okr)
    await okrService.remove(ctx.tenant, ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Replace the ordered key results (draft, needs_revision)' })
  @ApiBody({ type: () => replaceKeyResultsValidator })
  async replaceKeyResults(ctx: HttpContext) {
    const { params, keyResults } = await ctx.request.validateUsing(replaceKeyResultsValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('editKeyResults', okr, inTeam)
    const view = await okrService.replaceKeyResults(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      keyResults,
      auditContext(ctx)
    )
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'Progress of a key result (done, current value)' })
  @ApiBody({ type: () => updateKeyResultValidator })
  async updateKeyResult(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateKeyResultValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('progressKeyResult', okr, inTeam)
    const view = await okrService.updateKeyResult(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      params.krId,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'Submit the OKR to the manager' })
  async submit(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { okr } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('submitOkr', okr)
    const view = await okrService.submit(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      auditContext(ctx)
    )
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'Validate a pending OKR' })
  @ApiBody({ type: () => validateOkrValidator })
  async validate(ctx: HttpContext) {
    const { params, comment } = await ctx.request.validateUsing(validateOkrValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('decideOkr', okr, inTeam)
    const view = await okrService.validate(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      comment,
      auditContext(ctx)
    )
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'Send a pending OKR back for revision (comment required)' })
  @ApiBody({ type: () => requestRevisionValidator })
  async requestRevision(ctx: HttpContext) {
    const { params, comment } = await ctx.request.validateUsing(requestRevisionValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('decideOkr', okr, inTeam)
    const view = await okrService.requestRevision(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      comment,
      auditContext(ctx)
    )
    return ctx.serialize(viewDto(view))
  }

  @ApiOperation({ summary: 'Check-ins of an OKR, newest first' })
  async checkins(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(idValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewOkr', okr, inTeam)
    const rows = await okrService.checkins(ctx.tenant, okr.id)
    return { data: rows.map(okrCheckinDto) }
  }

  @ApiOperation({ summary: 'Add a check-in to a validated OKR' })
  @ApiBody({ type: () => createCheckinValidator })
  async storeCheckin(ctx: HttpContext) {
    const { params, message } = await ctx.request.validateUsing(createCheckinValidator)
    const { okr, inTeam } = await okrService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(PerformancePolicy).authorize('viewOkr', okr, inTeam)
    const checkin = await okrService.addCheckin(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      okr.id,
      message,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(okrCheckinDto(checkin))
  }
}
