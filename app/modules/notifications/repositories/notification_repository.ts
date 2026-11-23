import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Notification from '#models/notification'
import { TenantRepository } from '#shared/base/tenant_repository'
import type { Cursor } from '#shared/pagination/cursor'

/** Notifications of the organization; every read is also bound to one user. */
export class NotificationRepository extends TenantRepository<typeof Notification> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Notification, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<Notification>>) {
    return Notification.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  /** `limit + 1` rows after the cursor, newest first: the extra one tells a next page exists. */
  page(userId: string, options: { cursor: Cursor | null; limit: number; unreadOnly: boolean }) {
    const query = this.query().where('user_id', userId)
    if (options.unreadOnly) query.whereNull('read_at')
    if (options.cursor) {
      query.whereRaw('(created_at, id) < (?, ?)', [options.cursor.createdAt, options.cursor.id])
    }
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(options.limit + 1)
  }

  async unreadCount(userId: string): Promise<number> {
    const row = await this.query()
      .where('user_id', userId)
      .whereNull('read_at')
      .count('* as total')
      .first()
    return Number(row?.$extras.total ?? 0)
  }

  findOfUser(userId: string, id: string) {
    return this.query().where('user_id', userId).where('id', id).first()
  }

  async markAllRead(userId: string, at: DateTime): Promise<number> {
    const updated = await this.query()
      .where('user_id', userId)
      .whereNull('read_at')
      .update({ read_at: at.toJSDate() })
    return Array.isArray(updated) ? Number(updated[0] ?? 0) : Number(updated)
  }

  /** An unread twin created since `since`, to group identical notifications (07 §8). */
  recentTwin(userId: string, type: string, link: string | null, since: DateTime) {
    const query = this.query()
      .where('user_id', userId)
      .where('type', type)
      .whereNull('read_at')
      .where('created_at', '>=', since.toJSDate())
    if (link === null) query.whereNull('link')
    else query.where('link', link)
    return query.orderBy('created_at', 'desc').forUpdate().first()
  }
}

export function notificationsIn(organizationId: string, trx: TransactionClientContract) {
  return new NotificationRepository(organizationId, trx)
}
