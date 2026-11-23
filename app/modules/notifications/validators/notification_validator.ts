import vine from '@vinejs/vine'

/** GET /me/notifications (06 §2, 01 §7): cursor pagination. */
export const listNotificationsValidator = vine.create({
  cursor: vine.string().trim().maxLength(512).optional(),
  limit: vine.number().withoutDecimals().min(1).max(100).optional(),
  unreadOnly: vine.boolean().optional(),
})

export const notificationIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid() }),
})
