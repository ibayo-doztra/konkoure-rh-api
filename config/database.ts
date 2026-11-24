import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

/**
 * PostgreSQL uniquement (docs/backend/00 §3).
 * Variables : docs/backend/11 §1 « Base de données ».
 *
 * Objet séparé : `statement_timeout` est une option du driver `pg`
 * absente des types de Lucid (un littéral inline serait refusé par tsc).
 */
const pgConnection = {
  host: env.get('DB_HOST'),
  port: env.get('DB_PORT'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD'),
  database: env.get('DB_DATABASE'),
  ssl: env.get('DB_SSL', false) ? { rejectUnauthorized: true } : false,
  /**
   * Coupe côté serveur toute requête dépassant ce délai.
   */
  statement_timeout: env.get('DB_STATEMENT_TIMEOUT_MS', 10_000),
}

/**
 * Seul le serveur HTTP prend le rôle applicatif : les migrations gardent le rôle
 * propriétaire. Inutile quand DB_USER est déjà `konkoure_app` (production).
 */
/**
 * Names of the monthly partitions (`<table>_YYYY_MM`) that may exist, from
 * 2026 to two years ahead: the schema generator only excludes exact names.
 */
function monthlyPartitions(table: string) {
  const names: string[] = []
  const lastYear = new Date().getUTCFullYear() + 2
  for (let year = 2026; year <= lastYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      names.push(`${table}_${year}_${String(month).padStart(2, '0')}`)
    }
  }
  return names
}

const appRole = app.getEnvironment() === 'web' ? env.get('DB_APP_ROLE') : undefined

type PgConnection = { query(sql: string, done: (error: Error | null) => void): void }

/** A pool whose connections take `role` (no-op without the application role, e.g. tests). */
function poolAs(role: string | undefined) {
  return {
    min: env.get('DB_POOL_MIN', 2),
    max: env.get('DB_POOL_MAX', 20),
    ...(role && {
      afterCreate(connection: PgConnection, done: (e: Error | null, c: PgConnection) => void) {
        connection.query(`SET ROLE ${role}`, (error) => done(error, connection))
      },
    }),
  }
}

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    /**
     * Back-office reads across organizations (docs/backend/05 §1: platform
     * tasks use `konkoure_worker`, BYPASSRLS). Only when the web server runs
     * under the application role; otherwise the default connection is used.
     */
    platform: {
      client: 'pg',
      connection: pgConnection,
      pool: { ...poolAs(appRole ? 'konkoure_worker' : undefined), min: 0, max: 5 },
    },
    pg: {
      client: 'pg',
      connection: pgConnection,
      pool: poolAs(appRole),
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
        // Partitions techniques, pas des entités métier (09 §4).
        excludeTables: [
          'audit_logs_default',
          'time_logs_default',
          ...monthlyPartitions('time_logs'),
        ],
      },
      debug: app.inDev,
    },
  },
})

export default dbConfig
