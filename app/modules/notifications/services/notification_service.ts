import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import i18nManager from '@adonisjs/i18n/services/main'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { decodeCursor, encodeCursor } from '#shared/pagination/cursor'
import { notificationsIn } from '#modules/notifications/repositories/notification_repository'

/** Types of 07 §8 emitted by the modules delivered so far. */
export type NotificationType =
  | 'leave.requested'
  | 'leave.decided'
  | 'contract.expiring'
  | 'badge.assigned'
  | 'okr.submitted'
  | 'okr.validated'
  | 'okr.needs_revision'
  | 'okr.checkin_reminder'

/** Identical unread notifications within this window are grouped (07 §8). */
const GROUPING_MINUTES = 5
/** Retention of 05 §13 and 07 §8. */
export const RETENTION_DAYS = 180
const PURGE_BATCH = 5000

export interface Recipient {
  id: string
  preferredLanguage: string
}

export interface NotificationMessage {
  type: NotificationType
  /** Translation key under `notifications.`, with `title` and `body`. */
  key: string
  data?: Record<string, string>
  /** Front-end path the notification opens. */
  link?: string | null
  payload?: Record<string, unknown>
}

export interface NotificationQuery {
  cursor?: string
  limit?: number
  unreadOnly?: boolean
}

/**
 * In-app notifications (docs/backend/06 §2, 07 §8). Only the API creates
 * them, from business events, after the commit of the action.
 */
export class NotificationService {
  /**
   * Notifies each recipient but the author of the action. The title and body
   * are rendered in the recipient's language. Never throws: a failure is logged.
   */
  async notify(
    organizationId: string,
    recipients: Recipient[],
    message: NotificationMessage,
    actorUserId: string | null
  ) {
    const unique = new Map(recipients.map((recipient) => [recipient.id, recipient]))
    if (actorUserId) unique.delete(actorUserId)
    for (const recipient of unique.values()) {
      try {
        await this.write(organizationId, recipient, message)
      } catch (error) {
        logger.error(
          { err: error, type: message.type, userId: recipient.id },
          'notification.write_failed'
        )
      }
    }
  }

  private write(organizationId: string, recipient: Recipient, message: NotificationMessage) {
    const locale = recipient.preferredLanguage === 'en' ? 'en' : 'fr'
    const i18n = i18nManager.locale(locale)
    const title = i18n.t(`notifications.${message.key}.title`, message.data ?? {})
    const body = i18n.t(`notifications.${message.key}.body`, message.data ?? {})
    const link = message.link ?? null
    const now = DateTime.now()
    return withTenant(organizationId, async (trx) => {
      const notifications = notificationsIn(organizationId, trx)
      const twin = await notifications.recentTwin(
        recipient.id,
        message.type,
        link,
        now.minus({ minutes: GROUPING_MINUTES })
      )
      if (twin) {
        twin.merge({ title, body, payload: message.payload ?? {}, createdAt: now })
        return notifications.save(twin)
      }
      return notifications.create({
        userId: recipient.id,
        type: message.type,
        title,
        body,
        link,
        payload: message.payload ?? {},
      })
    })
  }

  /** GET /me/notifications: the caller's notifications in the current organization. */
  list(tenant: TenantContext, userId: string, query: NotificationQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const limit = query.limit ?? 50
    return withTenant(tenant.organizationId, async (trx) => {
      const notifications = notificationsIn(tenant.organizationId, trx)
      const rows = await notifications.page(userId, {
        cursor,
        limit,
        unreadOnly: query.unreadOnly === true,
      })
      const page = rows.slice(0, limit)
      const last = page.at(-1)
      return {
        rows: page,
        nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
        unreadCount: await notifications.unreadCount(userId),
      }
    })
  }

  /** Another user's notification is indistinguishable from a missing one: 404. */
  read(tenant: TenantContext, userId: string, id: string) {
    return withTenant(tenant.organizationId, async (trx) => {
      const notifications = notificationsIn(tenant.organizationId, trx)
      const notification = await notifications.findOfUser(userId, id)
      if (!notification) throw new AppException('E_NOT_FOUND')
      if (!notification.readAt) {
        notification.readAt = DateTime.now()
        await notifications.save(notification)
      }
      return notification
    })
  }

  readAll(tenant: TenantContext, userId: string) {
    return withTenant(tenant.organizationId, (trx) =>
      notificationsIn(tenant.organizationId, trx).markAllRead(userId, DateTime.now())
    )
  }

  /**
   * `notifications.purge` (daily): deletes notifications older than 180 days,
   * every organization at once, in batches. Runs as the worker, outside any tenant.
   */
  async purge(at: DateTime = DateTime.now()) {
    const before = at.minus({ days: RETENTION_DAYS }).toJSDate()
    let removed = 0
    for (;;) {
      const result = await db.rawQuery(
        `DELETE FROM notifications WHERE id IN (
           SELECT id FROM notifications WHERE created_at < ? LIMIT ?
         )`,
        [before, PURGE_BATCH]
      )
      const count = Number(result.rowCount ?? 0)
      removed += count
      if (count < PURGE_BATCH) break
    }
    logger.info({ removed }, 'notifications.purge_done')
    return removed
  }
}

export default new NotificationService()
