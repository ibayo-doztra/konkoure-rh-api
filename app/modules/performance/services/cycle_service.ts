import type { DateTime } from 'luxon'
import type User from '#models/user'
import type PerformanceCycle from '#models/performance_cycle'
import type { CycleFrequency, CycleStatus } from '#models/performance_cycle'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { cyclesIn } from '#modules/performance/repositories/cycle_repository'

export interface CycleInput {
  name?: string
  frequency?: CycleFrequency
  periodStart?: DateTime
  periodEnd?: DateTime
  selfEvalOpensAt?: DateTime | null
  selfEvalClosesAt?: DateTime | null
}

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'status', rule, message }] })

function defined<T extends object>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/** Evaluation cycles (docs/backend/06 §9): `draft → open → closed`. */
export class CycleService {
  list(tenant: TenantContext, filters: { page: number; perPage: number; status?: CycleStatus }) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => cyclesIn(organizationId, trx).paginate(filters))
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: CycleInput & { name: string; frequency: CycleFrequency },
    audit: AuditContext
  ): Promise<PerformanceCycle> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      this.assertDates(input)
      const cycle = await cyclesIn(organizationId, trx).create({
        ...defined(input),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'performance_cycle.created',
        targetType: 'performance_cycle',
        targetId: cycle.id,
        after: { name: input.name, frequency: input.frequency },
      })
      await cycle.refresh()
      return cycle
    })
  }

  /** A closed cycle is frozen. */
  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: CycleInput,
    audit: AuditContext
  ): Promise<PerformanceCycle> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const cycles = cyclesIn(organizationId, trx)
      const cycle = await cycles.findForUpdate(id)
      if (!cycle) throw new AppException('E_NOT_FOUND')
      if (cycle.status === 'closed') throw conflict('closed', 'validation.performance.cycleClosed')

      const changes = defined(input)
      this.assertDates({
        periodStart: changes.periodStart ?? cycle.periodStart,
        periodEnd: changes.periodEnd ?? cycle.periodEnd,
        selfEvalOpensAt:
          input.selfEvalOpensAt === undefined ? cycle.selfEvalOpensAt : input.selfEvalOpensAt,
        selfEvalClosesAt:
          input.selfEvalClosesAt === undefined ? cycle.selfEvalClosesAt : input.selfEvalClosesAt,
      })
      cycle.merge({ ...changes, updatedBy: actor.id })
      await cycles.save(cycle)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'performance_cycle.updated',
        targetType: 'performance_cycle',
        targetId: id,
        after: { changedFields: Object.keys(changes) },
      })
      await cycle.refresh()
      return cycle
    })
  }

  open(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    return this.transition(tenant, actor, id, 'draft', 'open', audit)
  }

  close(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    return this.transition(tenant, actor, id, 'open', 'closed', audit)
  }

  private transition(
    tenant: TenantContext,
    actor: User,
    id: string,
    from: CycleStatus,
    to: CycleStatus,
    audit: AuditContext
  ): Promise<PerformanceCycle> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const cycles = cyclesIn(organizationId, trx)
      const cycle = await cycles.findForUpdate(id)
      if (!cycle) throw new AppException('E_NOT_FOUND')
      if (cycle.status !== from) {
        const key = from === 'draft' ? 'cycleNotDraft' : 'cycleNotOpen'
        throw conflict(key, `validation.performance.${key}`)
      }
      cycle.merge({ status: to, updatedBy: actor.id })
      await cycles.save(cycle)
      await auditService.record(trx, this.context(tenant, audit), {
        action: `performance_cycle.${to === 'open' ? 'opened' : 'closed'}`,
        targetType: 'performance_cycle',
        targetId: id,
        before: { status: from },
        after: { status: to },
      })
      await cycle.refresh()
      return cycle
    })
  }

  private assertDates(input: CycleInput) {
    if (input.periodStart && input.periodEnd && input.periodEnd < input.periodStart) {
      throw AppException.validation('periodEnd', 'afterStart', 'validation.performance.periodEnd')
    }
    if (
      input.selfEvalOpensAt &&
      input.selfEvalClosesAt &&
      input.selfEvalClosesAt < input.selfEvalOpensAt
    ) {
      throw AppException.validation(
        'selfEvalClosesAt',
        'afterOpen',
        'validation.performance.selfEvalCloses'
      )
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new CycleService()
