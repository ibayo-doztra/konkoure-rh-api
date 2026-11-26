import Organization from '#models/organization'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import type { SubscriptionStatus } from '#models/subscription'
import { platformClient } from '#shared/platform/platform_client'

export interface OrganizationListFilters {
  page: number
  perPage: number
  q?: string
  status?: SubscriptionStatus
  planCode?: string
  /** Deleted organizations still restorable (not purged) instead of live ones. */
  deleted?: boolean
}

export interface OrganizationRow {
  id: string
  name: string
  slug: string
  createdAt: Date
  deletedAt: Date | null
  employees: number
  subscriptionStatus: SubscriptionStatus | null
  cycle: string | null
  planCode: string | null
  planName: string | null
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}

const likePattern = (value: string) =>
  `%${value.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** Current subscription of each organization: the most recent row (as `SubscriptionRepository.current`). */
const CURRENT_SUBSCRIPTION = `LEFT JOIN LATERAL (
  SELECT s.* FROM subscriptions s
   WHERE s.organization_id = o.id
   ORDER BY s.created_at DESC, s.id DESC
   LIMIT 1
) cs ON true`

/**
 * @platformScope — organizations across tenants for the back office
 * (docs/backend/06 §13). Reads only, through `platformClient()`.
 */
export class PlatformOrganizationRepository {
  async paginate(filters: OrganizationListFilters) {
    const client = platformClient()
    const base = () => {
      const query = client
        .from('organizations as o')
        .joinRaw(CURRENT_SUBSCRIPTION)
        .leftJoin('plans as p', 'p.id', 'cs.plan_id')
      if (filters.deleted) query.whereNotNull('o.deleted_at').whereNull('o.purged_at')
      else query.whereNull('o.deleted_at')
      if (filters.q) {
        const pattern = likePattern(filters.q)
        query.where((search) =>
          search.whereRaw('lower(o.name) like ?', [pattern]).orWhereRaw('o.slug like ?', [pattern])
        )
      }
      if (filters.status) query.where('cs.status', filters.status)
      if (filters.planCode) query.where('p.code', filters.planCode)
      return query
    }
    const [{ total }] = await base().count('* as total')
    const rows = await base()
      .select(
        'o.id',
        'o.name',
        'o.slug',
        'o.created_at',
        'o.deleted_at',
        'cs.status as subscription_status',
        'cs.cycle',
        'cs.trial_ends_at',
        'cs.current_period_end',
        'p.code as plan_code',
        'p.name as plan_name'
      )
      .select(
        client.raw(
          `(SELECT count(*) FROM employees e
             WHERE e.organization_id = o.id AND e.deleted_at IS NULL
               AND e.status <> 'terminated')::int AS employees`
        )
      )
      .orderBy('o.created_at', 'desc')
      .orderBy('o.id', 'desc')
      .limit(filters.perPage)
      .offset((filters.page - 1) * filters.perPage)
    return {
      total: Number(total),
      rows: rows.map((row): OrganizationRow => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
        employees: row.employees,
        subscriptionStatus: row.subscription_status,
        cycle: row.cycle,
        planCode: row.plan_code,
        planName: row.plan_name,
        trialEndsAt: row.trial_ends_at,
        currentPeriodEnd: row.current_period_end,
      })),
    }
  }

  find(id: string) {
    return Organization.query({ client: platformClient() }).where('id', id).first()
  }

  currentSubscription(organizationId: string) {
    return Subscription.query({ client: platformClient() })
      .where('organization_id', organizationId)
      .preload('plan')
      .preload('scheduledPlan')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .first()
  }

  /** Members (distinct accounts with a role) and present employees of the organization. */
  async counts(organizationId: string) {
    const client = platformClient()
    const [members] = await client
      .from('user_roles')
      .where('organization_id', organizationId)
      .countDistinct('user_id as total')
    const [employees] = await client
      .from('employees')
      .where('organization_id', organizationId)
      .whereNull('deleted_at')
      .whereNot('status', 'terminated')
      .count('* as total')
    return { members: Number(members.total), employees: Number(employees.total) }
  }

  /** Owners of the organization, reduced to what support needs to contact them. */
  owners(organizationId: string) {
    return platformClient()
      .from('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.organization_id', organizationId)
      .where('ur.role', 'owner')
      .whereNull('u.deleted_at')
      .orderBy('u.email', 'asc')
      .select('u.id', 'u.email', 'u.full_name as fullName') as Promise<
      Array<{ id: string; email: string; fullName: string | null }>
    >
  }

  /** Current subscription of every live organization, with its plan (dashboard). */
  currentSubscriptions() {
    const client = platformClient()
    return Subscription.query({ client })
      .whereIn(
        'id',
        client
          .from('organizations as o')
          .joinRaw(CURRENT_SUBSCRIPTION)
          .whereNull('o.deleted_at')
          .whereNotNull('cs.id')
          .select('cs.id')
      )
      .preload('plan')
  }

  async liveOrganizations() {
    const [row] = await platformClient()
      .from('organizations')
      .whereNull('deleted_at')
      .count('* as total')
    return Number(row.total)
  }

  /** A plan still used by a non-expired subscription, now or at its term. */
  async planInUse(planId: string) {
    const row = await platformClient()
      .from('subscriptions')
      .whereNot('status', 'expired')
      .where((query) => query.where('plan_id', planId).orWhere('scheduled_plan_id', planId))
      .first()
    return Boolean(row)
  }

  plans() {
    return Plan.query().orderBy('sort_order', 'asc').orderBy('code', 'asc')
  }
}

export default new PlatformOrganizationRepository()
