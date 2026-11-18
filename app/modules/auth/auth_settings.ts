import env from '#start/env'
import app from '@adonisjs/core/services/app'
import string from '@adonisjs/core/helpers/string'

/** Authentication settings, with the defaults of docs/backend/11 §1. */
const ttl = (value: string) => string.milliseconds.parse(value)

export const authSettings = {
  accessTokenTtlMs: ttl(env.get('ACCESS_TOKEN_TTL', '15m')),
  refreshTokenTtlMs: ttl(env.get('REFRESH_TOKEN_TTL', '30d')),
  refreshTokenTtlMobileMs: ttl(env.get('REFRESH_TOKEN_TTL_MOBILE', '90d')),
  emailVerificationTtl: env.get('EMAIL_VERIFICATION_TTL', '24h'),
  passwordResetTtlMs: ttl(env.get('PASSWORD_RESET_TTL', '1h')),
  maxLoginAttempts: env.get('MAX_LOGIN_ATTEMPTS', 5),
  lockoutMs: ttl(env.get('LOCKOUT_DURATION', '15m')),
  webAppUrl: env.get('WEB_APP_URL').replace(/\/+$/, ''),

  /** httpOnly refresh cookie for the web client (docs/backend/04 §1). */
  refreshCookie: {
    name: 'konkoure_refresh',
    options: {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: app.inProduction,
      path: '/api/v1/auth',
      domain: env.get('REFRESH_COOKIE_DOMAIN') || undefined,
    },
  },
}
