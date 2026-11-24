import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Plan from '#models/plan'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import organizations from '#modules/platform/repositories/platform_organization_repository'

export interface PlanInput {
  code?: string
  name?: string
  priceGnf?: number
  priceYearlyGnf?: number | null
  maxEmployees?: number
  aiCreditsPerMonth?: number
  modules?: string[]
  features?: string[]
  sortOrder?: number
  isPublic?: boolean
}

const snapshot = (plan: Plan) => ({
  code: plan.code,
  name: plan.name,
  priceGnf: Number(plan.priceGnf),
  priceYearlyGnf: plan.priceYearlyGnf === null ? null : Number(plan.priceYearlyGnf),
  maxEmployees: plan.maxEmployees,
  aiCreditsPerMonth: plan.aiCreditsPerMonth,
  modules: plan.modules,
  isPublic: plan.isPublic,
})

/**
 * @platformScope — global plan catalogue (docs/backend/06 §13): support reads,
 * root writes. A plan is deleted logically, never while a subscription uses
 * it (decision of 2026-11-24). Audited without organization.
 */
export class PlatformPlanService {
  list() {
    return organizations.plans()
  }

  async create(
    actor: User,
    input: PlanInput & { code: string; name: string },
    audit: AuditContext
  ) {
    if (await Plan.findBy('code', input.code)) {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'code', rule: 'taken', message: 'validation.platform.planCodeTaken' }],
      })
    }
    return db.transaction(async (trx) => {
      const plan = await Plan.create(this.columns(input), { client: trx })
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: 'platform_root' },
        { action: 'plan.created', targetType: 'plan', targetId: plan.id, after: snapshot(plan) }
      )
      await plan.refresh()
      return plan
    })
  }

  update(actor: User, id: string, input: PlanInput, audit: AuditContext) {
    return db.transaction(async (trx) => {
      const plan = await Plan.query({ client: trx })
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first()
      if (!plan) throw new AppException('E_NOT_FOUND')
      const before = snapshot(plan)
      plan.merge(this.columns(input))
      await plan.useTransaction(trx).save()
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: 'platform_root' },
        { action: 'plan.updated', targetType: 'plan', targetId: id, before, after: snapshot(plan) }
      )
      return plan
    })
  }

  async remove(actor: User, id: string, audit: AuditContext) {
    if (await organizations.planInUse(id)) {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'id', rule: 'inUse', message: 'validation.platform.planInUse' }],
      })
    }
    await db.transaction(async (trx) => {
      const plan = await Plan.query({ client: trx })
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first()
      if (!plan) throw new AppException('E_NOT_FOUND')
      plan.deletedAt = DateTime.now()
      await plan.useTransaction(trx).save()
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: 'platform_root' },
        { action: 'plan.deleted', targetType: 'plan', targetId: id, before: snapshot(plan) }
      )
    })
  }

  private columns(input: PlanInput) {
    const columns: Partial<Plan> = {}
    if (input.code !== undefined) columns.code = input.code
    if (input.name !== undefined) columns.name = input.name
    if (input.priceGnf !== undefined) columns.priceGnf = String(input.priceGnf)
    if (input.priceYearlyGnf !== undefined) {
      columns.priceYearlyGnf = input.priceYearlyGnf === null ? null : String(input.priceYearlyGnf)
    }
    if (input.maxEmployees !== undefined) columns.maxEmployees = input.maxEmployees
    if (input.aiCreditsPerMonth !== undefined) columns.aiCreditsPerMonth = input.aiCreditsPerMonth
    if (input.modules !== undefined) columns.modules = input.modules
    if (input.features !== undefined) columns.features = input.features
    if (input.sortOrder !== undefined) columns.sortOrder = input.sortOrder
    if (input.isPublic !== undefined) columns.isPublic = input.isPublic
    return columns
  }
}

export default new PlatformPlanService()
