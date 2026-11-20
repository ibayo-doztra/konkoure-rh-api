import type Notification from '#models/notification'

export function notificationDto(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    payload: notification.payload,
    readAt: notification.readAt?.toISO() ?? null,
    createdAt: notification.createdAt.toISO(),
  }
}
