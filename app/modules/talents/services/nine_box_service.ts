import type PerformanceReview from '#models/performance_review'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { resolveOrganizationSettings } from '#modules/organizations/transformers/organization_transformer'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { cyclesIn } from '#modules/performance/repositories/cycle_repository'
import { reviewsIn } from '#modules/performance/repositories/review_repository'
import { visibleEmployeeIds } from '#modules/performance/scope'

export const NINE_BOX_LEVELS = ['low', 'medium', 'high'] as const
export type NineBoxLevel = (typeof NINE_BOX_LEVELS)[number]

export interface NineBoxThresholds {
  lowMax: number
  mediumMax: number
}

export interface NineBoxPlacement {
  review: PerformanceReview
  name: string
  /** Score used on the performance axis (explicit, or the signed manager score). */
  performance: number | null
  potential: number | null
}

export interface NineBox {
  cycleId: string
  thresholds: NineBoxThresholds
  cells: Array<{
    performance: NineBoxLevel
    potential: NineBoxLevel
    placements: NineBoxPlacement[]
  }>
  unplaced: NineBoxPlacement[]
}

export function levelOf(score: number, thresholds: NineBoxThresholds): NineBoxLevel {
  if (score <= thresholds.lowMax) return 'low'
  if (score <= thresholds.mediumMax) return 'medium'
  return 'high'
}

/**
 * 9-box of a cycle (07 §5.10, decision of 2026-11-24): performance axis =
 * `performance_score`, else the `manager_score` of the signed evaluation;
 * potential axis = `potential_score` set by HR. Evaluations missing either
 * axis are listed as `unplaced`.
 */
export class NineBoxService {
  show(tenant: TenantContext, cycleId: string): Promise<NineBox> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      await cyclesIn(organizationId, trx).findOrFail(cycleId)
      const organization = await organizations.findActive(organizationId, trx)
      const thresholds = resolveOrganizationSettings(organization?.settings ?? {}).talents.nineBox

      // A manager sees the team, not their own placement (04 §5 "talents").
      const visible = await visibleEmployeeIds(tenant, trx)
      const scope =
        visible && tenant.employeeId ? visible.filter((id) => id !== tenant.employeeId) : visible
      const reviews = await reviewsIn(organizationId, trx).ofCycle(cycleId, scope)
      const names = await employeesIn(organizationId, trx).namesOf(
        reviews.map((review) => review.employeeId)
      )

      const placements = reviews
        .map((review) => ({
          review,
          name: names.get(review.employeeId) ?? '',
          performance:
            review.performanceScore ?? (review.status === 'signed' ? review.managerScore : null),
          potential: review.potentialScore,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

      const cells = NINE_BOX_LEVELS.flatMap((performance) =>
        NINE_BOX_LEVELS.map((potential) => ({
          performance,
          potential,
          placements: [] as NineBoxPlacement[],
        }))
      )
      const unplaced: NineBoxPlacement[] = []
      for (const placement of placements) {
        if (placement.performance === null || placement.potential === null) {
          unplaced.push(placement)
          continue
        }
        const performance = levelOf(placement.performance, thresholds)
        const potential = levelOf(placement.potential, thresholds)
        cells
          .find((cell) => cell.performance === performance && cell.potential === potential)
          ?.placements.push(placement)
      }
      return { cycleId, thresholds, cells, unplaced }
    })
  }
}

export default new NineBoxService()
