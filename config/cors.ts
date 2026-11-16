import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

/**
 * Explicit allowlist from CORS_ORIGINS (comma separated). Credentials are allowed
 * because the web refresh token travels in an httpOnly cookie (docs/backend/04 §1).
 * In development, any origin is reflected when CORS_ORIGINS is empty.
 */
const allowed = (env.get('CORS_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const corsConfig = defineConfig({
  enabled: true,
  origin: allowed.length > 0 ? allowed : app.inDev,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: ['X-Request-Id', 'Retry-After', 'Idempotent-Replay'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
