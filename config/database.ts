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
const appRole = app.getEnvironment() === 'web' ? env.get('DB_APP_ROLE') : undefined

type PgConnection = { query(sql: string, done: (error: Error | null) => void): void }

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    pg: {
      client: 'pg',
      connection: pgConnection,
      pool: {
        min: env.get('DB_POOL_MIN', 2),
        max: env.get('DB_POOL_MAX', 20),
        ...(appRole && {
          afterCreate(connection: PgConnection, done: (e: Error | null, c: PgConnection) => void) {
            connection.query(`SET ROLE ${appRole}`, (error) => done(error, connection))
          },
        }),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
        // Partition technique, pas une entité métier.
        excludeTables: ['audit_logs_default'],
      },
      debug: app.inDev,
    },
  },
})

export default dbConfig
