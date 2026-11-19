/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Every variable is declared and validated here (docs/backend/01 §9, 11 §1).
| A missing or invalid variable makes the process fail at boot.
| `process.env` must never be read anywhere else.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Cœur
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  WEB_APP_URL: Env.schema.string({ format: 'url', tld: false }),
  DEFAULT_LOCALE: Env.schema.enum.optional(['fr', 'en'] as const),

  // Base de données (PostgreSQL)
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  DB_SSL: Env.schema.boolean.optional(),
  DB_POOL_MIN: Env.schema.number.optional(),
  DB_POOL_MAX: Env.schema.number.optional(),
  DB_STATEMENT_TIMEOUT_MS: Env.schema.number.optional(),
  // Rôle pris par le serveur HTTP quand DB_USER en est membre (RLS, 05 §1)
  DB_APP_ROLE: Env.schema.enum.optional(['konkoure_app'] as const),

  // Redis
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.secret.optional(),
  REDIS_TLS: Env.schema.boolean.optional(),
  REDIS_DB_CACHE: Env.schema.number.optional(),
  REDIS_DB_QUEUE: Env.schema.number.optional(),
  REDIS_DB_LIMITER: Env.schema.number.optional(),

  // Files : `sync` exécute les jobs dans le processus (développement, tests)
  QUEUE_DRIVER: Env.schema.enum.optional(['bullmq', 'sync'] as const),

  // Rate limit : `memory` réservé aux tests (store non partagé entre réplicas)
  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),
  /**
   * Global budget per IP and minute (default 300, docs/backend/05 §8). Test and
   * e2e environments only: refused at boot when NODE_ENV=production.
   */
  RATE_LIMIT_GLOBAL_IP_PER_MINUTE: Env.schema.number.optional(),

  // Authentification (docs/backend/04, 11 §1)
  ACCESS_TOKEN_TTL: Env.schema.string.optional(),
  REFRESH_TOKEN_TTL: Env.schema.string.optional(),
  REFRESH_TOKEN_TTL_MOBILE: Env.schema.string.optional(),
  EMAIL_VERIFICATION_TTL: Env.schema.string.optional(),
  PASSWORD_RESET_TTL: Env.schema.string.optional(),
  MAX_LOGIN_ATTEMPTS: Env.schema.number.optional(),
  LOCKOUT_DURATION: Env.schema.string.optional(),
  REFRESH_COOKIE_DOMAIN: Env.schema.string.optional(),

  // Sécurité
  CORS_ORIGINS: Env.schema.string.optional(),

  // Stockage (docs/backend/11 §1)
  DRIVE_DISK: Env.schema.enum.optional(['fs', 's3', 's3Public'] as const),
  S3_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  S3_REGION: Env.schema.string.optional(),
  S3_ACCESS_KEY_ID: Env.schema.string.optional(),
  S3_SECRET_ACCESS_KEY: Env.schema.secret.optional(),
  S3_BUCKET_PUBLIC: Env.schema.string.optional(),
  S3_BUCKET_PRIVATE: Env.schema.string.optional(),
  S3_PUBLIC_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // E-mail (Resend). Sans clé, les e-mails ne partent pas (dev local).
  MAIL_MAILER: Env.schema.enum(['resend'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string({ format: 'email' }),
  RESEND_API_KEY: Env.schema.secret.optional(),
})
