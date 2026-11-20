import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import notificationService from '#modules/notifications/services/notification_service'
import { notificationDto } from '#modules/notifications/transformers/notification_transformer'
import {
  listNotificationsValidator,
  notificationIdValidator,
} from '#modules/notifications/validators/notification_validator'

/**
 * The caller's own notifications in the current organization (06 §2). Every
 * query is bound to the authenticated user: no policy beyond membership.
 */
export default class NotificationsController {
  @ApiOperation({ summary: 'My notifications in the current organization (cursor)' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listNotificationsValidator)
    const user = ctx.auth.getUserOrFail()
    const page = await notificationService.list(ctx.tenant, user.id, query)
    return {
      data: page.rows.map(notificationDto),
      meta: { nextCursor: page.nextCursor, unreadCount: page.unreadCount },
    }
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  async read(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(notificationIdValidator)
    const user = ctx.auth.getUserOrFail()
    const notification = await notificationService.read(ctx.tenant, user.id, params.id)
    return ctx.serialize(notificationDto(notification))
  }

  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async readAll(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const updated = await notificationService.readAll(ctx.tenant, user.id)
    return ctx.serialize({ updated })
  }
}
