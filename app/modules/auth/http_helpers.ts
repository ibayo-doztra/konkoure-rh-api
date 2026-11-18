import type { HttpContext } from '@adonisjs/core/http'
import type { AuditContext } from '#shared/audit/audit_service'
import type { ClientInfo, IssuedTokens } from '#modules/auth/services/token_service'
import { authSettings } from '#modules/auth/auth_settings'

/** Request metadata recorded with sessions and audit rows. */
export function clientInfo(ctx: HttpContext, deviceLabel?: string | null): ClientInfo {
  return {
    ip: ctx.request.ip() ?? null,
    userAgent: ctx.request.header('user-agent')?.slice(0, 500) ?? null,
    deviceLabel: deviceLabel ?? null,
  }
}

export function auditContext(ctx: HttpContext): AuditContext {
  return {
    actorUserId: ctx.auth?.user?.id ?? null,
    actorEmail: ctx.auth?.user?.email ?? null,
    ip: ctx.request.ip() ?? null,
    userAgent: ctx.request.header('user-agent')?.slice(0, 500) ?? null,
    requestId: ctx.requestId,
  }
}

/** Family id of the session the request is authenticated with. */
export function currentFamilyId(ctx: HttpContext): string | null {
  return ctx.auth.user?.currentAccessToken?.name ?? null
}

export function setRefreshCookie(ctx: HttpContext, tokens: IssuedTokens) {
  ctx.response.cookie(authSettings.refreshCookie.name, tokens.refreshToken, {
    ...authSettings.refreshCookie.options,
    maxAge: tokens.refreshExpiresIn,
  })
}

export function clearRefreshCookie(ctx: HttpContext) {
  ctx.response.clearCookie(authSettings.refreshCookie.name, authSettings.refreshCookie.options)
}

export function readRefreshCookie(ctx: HttpContext): string | undefined {
  const value = ctx.request.cookie(authSettings.refreshCookie.name)
  return typeof value === 'string' ? value : undefined
}
