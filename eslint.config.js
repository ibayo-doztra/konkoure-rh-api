import { configApp } from '@adonisjs/eslint-config'

export default configApp({
  /**
   * Généré par `node ace migration:run` (schemaGeneration) : ne pas linter.
   */
  ignores: ['database/schema.ts'],
})
