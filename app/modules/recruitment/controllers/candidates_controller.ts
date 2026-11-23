import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import RecruitmentPolicy from '#policies/recruitment_policy'
import type Candidate from '#models/candidate'
import candidateService from '#modules/recruitment/services/candidate_service'
import {
  candidateDto,
  candidateEventDto,
  candidateNoteDto,
} from '#modules/recruitment/transformers/recruitment_transformer'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  candidateIdValidator,
  createCandidateValidator,
  documentUrlValidator,
  hireValidator,
  listCandidatesValidator,
  noteIdValidator,
  noteValidator,
  stageValidator,
  updateCandidateValidator,
} from '#modules/recruitment/validators/candidate_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/recruitment/candidates` (06-api-reference §8, 07 §4.5 to §4.7). */
export default class CandidatesController {
  @ApiOperation({ summary: 'List the candidates' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listCandidatesValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const { rows, meta } = await candidateService.list(ctx.tenant, query)
    const titles = await candidateService.jobTitles(ctx.tenant, [
      ...new Set(rows.map((row) => row.jobId)),
    ])
    return {
      data: rows.map((row) => candidateDto(row, titles.get(row.jobId) ?? null)),
      meta: pageMetaDto(meta),
    }
  }

  @ApiOperation({ summary: 'Add a candidate (multipart, pieces optional)' })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createCandidateValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const candidate = await candidateService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return this.render(ctx, candidate)
  }

  @ApiOperation({ summary: 'Candidate detail with AI signals' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(candidateIdValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    return this.render(ctx, await candidateService.find(ctx.tenant, params.id))
  }

  @ApiOperation({ summary: 'Update a candidate' })
  @ApiBody({ type: () => updateCandidateValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateCandidateValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const candidate = await candidateService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return this.render(ctx, candidate)
  }

  @ApiOperation({ summary: 'Delete a candidate and their files for good' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(candidateIdValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    await candidateService.remove(ctx.tenant, params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Move a candidate in the pipeline' })
  @ApiBody({ type: () => stageValidator })
  async stage(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(stageValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const candidate = await candidateService.stage(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return this.render(ctx, candidate)
  }

  @ApiOperation({ summary: 'Hire a candidate: creates the employee record' })
  @ApiBody({ type: () => hireValidator })
  async hire(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(hireValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const { candidate, employee } = await candidateService.hire(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    const titles = await candidateService.jobTitles(ctx.tenant, [candidate.jobId])
    return ctx.serialize({
      candidate: candidateDto(candidate, titles.get(candidate.jobId) ?? null),
      employeeId: employee.id,
    })
  }

  @ApiOperation({ summary: 'Signed link (15 min) to a piece of the application' })
  async documentUrl(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(documentUrlValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const candidate = await candidateService.find(ctx.tenant, params.id)
    return ctx.serialize(
      await candidateService.documentUrl(ctx.tenant, candidate, params.key, auditContext(ctx))
    )
  }

  @ApiOperation({ summary: 'Notes on a candidate, newest first' })
  async notes(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(candidateIdValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    await candidateService.find(ctx.tenant, params.id)
    const rows = await candidateService.notes(ctx.tenant, params.id)
    return { data: rows.map(candidateNoteDto) }
  }

  @ApiOperation({ summary: 'Add a note on a candidate' })
  @ApiBody({ type: () => noteValidator })
  async storeNote(ctx: HttpContext) {
    const { params, body } = await ctx.request.validateUsing(noteValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    await candidateService.find(ctx.tenant, params.id)
    const note = await candidateService.addNote(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      body,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(candidateNoteDto(note))
  }

  @ApiOperation({ summary: 'Delete a note (its author or O H)' })
  async destroyNote(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(noteIdValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    const note = await candidateService.findNote(ctx.tenant, params.id, params.noteId)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('deleteNote', note)
    await candidateService.removeNote(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      params.noteId,
      auditContext(ctx)
    )
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'History of a candidate, newest first' })
  async events(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(candidateIdValidator)
    await ctx.bouncer.with(RecruitmentPolicy).authorize('manageCandidates')
    await candidateService.find(ctx.tenant, params.id)
    const rows = await candidateService.events(ctx.tenant, params.id)
    return { data: rows.map(candidateEventDto) }
  }

  private async render(ctx: HttpContext, candidate: Candidate) {
    const titles = await candidateService.jobTitles(ctx.tenant, [candidate.jobId])
    return ctx.serialize(candidateDto(candidate, titles.get(candidate.jobId) ?? null))
  }
}
