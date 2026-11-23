import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type User from '#models/user'
import type Okr from '#models/okr'
import type { OkrReviewStatus, OkrStatus } from '#models/okr'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { okrsIn, type OkrRepository } from '#modules/performance/repositories/okr_repository'
import { isInViewerTeam, visibleEmployeeIds } from '#modules/performance/scope'
import okrNotifier from '#modules/performance/services/okr_notifier'

export interface KeyResultInput {
  title: string
  metric?: string | null
  targetValue?: number | null
  currentValue?: number | null
  unit?: string | null
  isDone?: boolean
}

export interface OkrListQuery {
  page?: number
  perPage?: number
  filter?: {
    employeeId?: string
    quarter?: string
    status?: OkrStatus
    reviewStatus?: OkrReviewStatus
  }
}

/** Review statuses in which the holder edits the objective and key results (07 §5.3). */
const EDITABLE: readonly OkrReviewStatus[] = ['draft', 'needs_revision']

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'reviewStatus', rule, message }] })

const decimal = (value: number | null | undefined) =>
  value === undefined || value === null ? null : String(value)

/** OKR, key results and check-ins (docs/backend/06 §9, 07 §5.3 to §5.6). */
export class OkrService {
  list(tenant: TenantContext, query: OkrListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const page = await okrs.paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        ...query.filter,
        employeeIds: await visibleEmployeeIds(tenant, trx),
      })
      const rows = page.all()
      const keyResults = await okrs.keyResultsOf(rows.map((row) => row.id))
      return { rows, keyResults, meta: page.getMeta() }
    })
  }

  /** An OKR and whether its holder is in the viewer's team, for the policy. */
  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const okr = await okrsIn(organizationId, trx).findOrFail(id)
      return { okr, inTeam: await isInViewerTeam(tenant, trx, okr.employeeId) }
    })
  }

  inTeam(tenant: TenantContext, employeeId: string) {
    return withTenant(tenant.organizationId, (trx) => isInViewerTeam(tenant, trx, employeeId))
  }

  /** OKR with its key results, for the responses. */
  view(tenant: TenantContext, okr: Okr) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => ({
      okr,
      keyResults: await okrsIn(organizationId, trx).keyResultsOf([okr.id]),
    }))
  }

  create(
    tenant: TenantContext,
    actor: User,
    employeeId: string,
    input: { quarter: string; objective: string },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      if (!(await employeesIn(organizationId, trx).find(employeeId))) {
        throw AppException.validation('employeeId', 'exists', 'validation.performance.employee')
      }
      const okrs = okrsIn(organizationId, trx)
      const okr = await okrs.create({
        ...input,
        employeeId,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.created',
        targetType: 'okr',
        targetId: okr.id,
        after: { employeeId, quarter: input.quarter },
      })
      await okr.refresh()
      return { okr, keyResults: [] }
    })
  }

  /** Objective and quarter, while the holder may still edit them. */
  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: { quarter?: string; objective?: string },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await this.lockEditable(okrs, id)
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
      )
      okr.merge({ ...changes, updatedBy: actor.id })
      await okrs.save(okr)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.updated',
        targetType: 'okr',
        targetId: id,
        after: { changedFields: Object.keys(changes) },
      })
      await okr.refresh()
      return { okr, keyResults: await okrs.keyResultsOf([id]) }
    })
  }

  /** The holder deletes while editable; owner and hr_admin at any time (06 §9). */
  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await okrs.findForUpdate(id)
      if (!okr) throw new AppException('E_NOT_FOUND')
      if (!tenant.hasRole('owner', 'hr_admin') && !EDITABLE.includes(okr.reviewStatus)) {
        throw conflict('locked', 'validation.performance.okrLocked')
      }
      okr.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await okrs.save(okr)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.deleted',
        targetType: 'okr',
        targetId: id,
        before: { reviewStatus: okr.reviewStatus, quarter: okr.quarter },
      })
    })
  }

  /** `PUT /okrs/:id/key-results`: the whole ordered list, while editable. */
  replaceKeyResults(
    tenant: TenantContext,
    actor: User,
    id: string,
    items: KeyResultInput[],
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await this.lockEditable(okrs, id)
      const now = DateTime.now()
      await okrs.replaceKeyResults(
        id,
        items.map((item) => ({
          title: item.title,
          metric: item.metric ?? null,
          targetValue: decimal(item.targetValue),
          currentValue: decimal(item.currentValue),
          unit: item.unit ?? null,
          isDone: item.isDone ?? false,
          doneAt: item.isDone ? now : null,
        }))
      )
      okr.merge({ updatedBy: actor.id })
      await okrs.save(okr)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.key_results_replaced',
        targetType: 'okr',
        targetId: id,
        after: { count: items.length },
      })
      await okr.refresh()
      return { okr, keyResults: await okrs.keyResultsOf([id]) }
    })
  }

  /**
   * Progress of one key result (`isDone`, `currentValue`): allowed while
   * editable and once validated, never while pending or after the quarter.
   */
  updateKeyResult(
    tenant: TenantContext,
    actor: User,
    id: string,
    keyResultId: string,
    input: { isDone?: boolean; currentValue?: number | null },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await okrs.findForUpdate(id)
      if (!okr) throw new AppException('E_NOT_FOUND')
      if (
        okr.reviewStatus === 'pending' ||
        okr.status === 'completed' ||
        okr.status === 'archived'
      ) {
        throw conflict('locked', 'validation.performance.okrLocked')
      }
      const keyResult = await okrs.findKeyResultForUpdate(id, keyResultId)
      if (!keyResult) throw new AppException('E_NOT_FOUND')

      if (input.currentValue !== undefined) keyResult.currentValue = decimal(input.currentValue)
      if (input.isDone !== undefined && input.isDone !== keyResult.isDone) {
        keyResult.isDone = input.isDone
        keyResult.doneAt = input.isDone ? DateTime.now() : null
      }
      keyResult.useTransaction(trx)
      await keyResult.save()
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.key_result_updated',
        targetType: 'okr',
        targetId: id,
        after: { keyResultId, isDone: keyResult.isDone },
      })
      okr.merge({ updatedBy: actor.id })
      await okrs.save(okr)
      await okr.refresh()
      return { okr, keyResults: await okrs.keyResultsOf([id]) }
    })
  }

  /** `draft | needs_revision → pending`, with at least one key result (07 §5.3). */
  async submit(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    const view = await withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await this.lockEditable(okrs, id)
      if ((await okrs.countKeyResults(id)) === 0) {
        throw AppException.validation(
          'keyResults',
          'required',
          'validation.performance.okrKeyResults'
        )
      }
      const before = { reviewStatus: okr.reviewStatus }
      okr.merge({ reviewStatus: 'pending', submittedAt: DateTime.now(), updatedBy: actor.id })
      await okrs.save(okr)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.submitted',
        targetType: 'okr',
        targetId: id,
        before,
        after: { reviewStatus: 'pending' },
      })
      await okr.refresh()
      return { okr, keyResults: await okrs.keyResultsOf([id]) }
    })
    await okrNotifier.submitted(view.okr, actor.id)
    return view
  }

  /** `pending → validated`; the OKR becomes active and its content frozen. */
  async validate(
    tenant: TenantContext,
    actor: User,
    id: string,
    comment: string | undefined,
    audit: AuditContext
  ) {
    return this.decide(tenant, actor, id, 'validated', comment, audit)
  }

  /** `pending → needs_revision`, the comment is mandatory (07 §5.3). */
  async requestRevision(
    tenant: TenantContext,
    actor: User,
    id: string,
    comment: string,
    audit: AuditContext
  ) {
    return this.decide(tenant, actor, id, 'needs_revision', comment, audit)
  }

  checkins(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => okrsIn(organizationId, trx).checkinsOf(id))
  }

  /** Check-ins follow a validated, active OKR (07 §5.5); the progress is snapshotted. */
  addCheckin(tenant: TenantContext, actor: User, id: string, message: string, audit: AuditContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await okrs.findForUpdate(id)
      if (!okr) throw new AppException('E_NOT_FOUND')
      if (okr.reviewStatus !== 'validated' || okr.status !== 'active') {
        throw conflict('notValidated', 'validation.performance.okrNotValidated')
      }
      const checkin = await okrs.createCheckin({
        okrId: id,
        authorEmployeeId: tenant.employeeId,
        message,
        progressSnapshot: okr.progress,
        createdBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'okr.checkin_created',
        targetType: 'okr',
        targetId: id,
        after: { checkinId: checkin.id, progress: okr.progress },
      })
      await checkin.refresh()
      return checkin
    })
  }

  /**
   * `okr:checkin-reminder` (docs/backend/08 §2, 07 §5.5): on the 25th, every
   * holder of a validated OKR without a check-in this month (organization
   * time zone) gets a notification.
   */
  async checkinReminders(at: DateTime = DateTime.now()) {
    let reminded = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        const due = await withTenant(organizationId, async (trx) => {
          const organization = await organizations.findActive(organizationId, trx)
          if (!organization) return []
          const monthStart = at.setZone(organization.timezone).startOf('month')
          return okrsIn(organizationId, trx).withoutCheckinSince(monthStart)
        })
        for (const okr of due) {
          await okrNotifier.checkinReminder(okr)
          reminded += 1
        }
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'okr.checkin_reminder_failed')
      }
    }
    logger.info({ reminded, failed: failed.length }, 'okr.checkin_reminder_done')
    if (failed.length > 0) {
      throw new Error(`okr:checkin-reminder failed for ${failed.length} organization(s)`)
    }
    return reminded
  }

  private async decide(
    tenant: TenantContext,
    actor: User,
    id: string,
    to: 'validated' | 'needs_revision',
    comment: string | undefined,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    const view = await withTenant(organizationId, async (trx) => {
      const okrs = okrsIn(organizationId, trx)
      const okr = await okrs.findForUpdate(id)
      if (!okr) throw new AppException('E_NOT_FOUND')
      if (okr.reviewStatus !== 'pending') {
        throw conflict('notPending', 'validation.performance.okrNotPending')
      }
      const now = DateTime.now()
      okr.merge(
        to === 'validated'
          ? {
              reviewStatus: 'validated',
              status: 'active',
              validatedAt: now,
              validatedBy: actor.id,
              ...(comment === undefined ? {} : { managerComment: comment }),
            }
          : { reviewStatus: 'needs_revision', managerComment: comment ?? null }
      )
      okr.updatedBy = actor.id
      await okrs.save(okr)
      await auditService.record(trx, this.context(tenant, audit), {
        action: to === 'validated' ? 'okr.validated' : 'okr.revision_requested',
        targetType: 'okr',
        targetId: id,
        before: { reviewStatus: 'pending' },
        after: { reviewStatus: to },
      })
      await okr.refresh()
      return { okr, keyResults: await okrs.keyResultsOf([id]) }
    })
    await okrNotifier.decided(view.okr, actor.id)
    return view
  }

  private async lockEditable(okrs: OkrRepository, id: string) {
    const okr = await okrs.findForUpdate(id)
    if (!okr) throw new AppException('E_NOT_FOUND')
    if (!EDITABLE.includes(okr.reviewStatus)) {
      throw conflict('locked', 'validation.performance.okrLocked')
    }
    return okr
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new OkrService()
