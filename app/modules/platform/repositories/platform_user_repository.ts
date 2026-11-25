import PlatformAdmin from '#models/platform_admin'
import User from '#models/user'
import { platformClient } from '#shared/platform/platform_client'

export interface Membership {
  organizationId: string
  organizationName: string
  roles: string[]
}

const likePattern = (value: string) =>
  `%${value.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** @platformScope — accounts across organizations, for the back office (06 §13). */
export class PlatformUserRepository {
  search(filters: { page: number; perPage: number; q?: string }) {
    const query = User.query().whereNull('deleted_at')
    if (filters.q) {
      const pattern = likePattern(filters.q)
      query.where((search) =>
        search
          .whereRaw('lower(email::text) like ?', [pattern])
          .orWhereRaw('lower(full_name) like ?', [pattern])
      )
    }
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }

  find(id: string) {
    return User.query().where('id', id).whereNull('deleted_at').first()
  }

  /** Organizations and roles of each account, live organizations only. */
  async memberships(userIds: string[]): Promise<Map<string, Membership[]>> {
    const result = new Map<string, Membership[]>()
    if (userIds.length === 0) return result
    const rows: Array<{ user_id: string; organization_id: string; name: string; role: string }> =
      await platformClient()
        .from('user_roles as ur')
        .join('organizations as o', 'o.id', 'ur.organization_id')
        .whereIn('ur.user_id', userIds)
        .whereNull('o.deleted_at')
        .orderBy('o.name', 'asc')
        .select('ur.user_id', 'ur.organization_id', 'o.name', 'ur.role')
    for (const row of rows) {
      const list = result.get(row.user_id) ?? []
      let entry = list.find((item) => item.organizationId === row.organization_id)
      if (!entry) {
        entry = { organizationId: row.organization_id, organizationName: row.name, roles: [] }
        list.push(entry)
      }
      entry.roles.push(row.role)
      result.set(row.user_id, list)
    }
    return result
  }

  /** Platform admin level of each account, active admins only. */
  async adminLevels(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, string>()
    const rows = await PlatformAdmin.query().whereIn('user_id', userIds).where('is_active', true)
    return new Map(rows.map((row) => [row.userId, row.level]))
  }
}

export default new PlatformUserRepository()
