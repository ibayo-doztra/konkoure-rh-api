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

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    pg: {
      client: 'pg',
      connection: pgConnection,
      pool: {
        min: env.get('DB_POOL_MIN', 2),
        max: env.get('DB_POOL_MAX', 20),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
      },
      debug: app.inDev,
    },
  },
})

export default dbConfig
