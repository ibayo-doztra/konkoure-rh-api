import type User from '#models/user'

/** Name of an impersonation access token: `impersonation:<admin user id>` (06 §13). */
export const IMPERSONATION_PREFIX = 'impersonation:'

/**
 * The impersonation carried by the request's access token, if any: the
 * platform admin behind it and the token's end (decision of 2026-11-24).
 */
export function impersonationOf(user: User | undefined) {
  const token = user?.currentAccessToken
  if (!token?.name?.startsWith(IMPERSONATION_PREFIX)) return null
  return {
    by: token.name.slice(IMPERSONATION_PREFIX.length),
    expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
  }
}
