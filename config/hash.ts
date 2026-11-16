import app from '@adonisjs/core/services/app'
import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * Argon2id with the parameters required by docs/backend/04 §2.
 * Tests use cheaper parameters: their hashes never need to resist brute force.
 */
const hashConfig = defineConfig({
  default: 'argon',

  list: {
    argon: drivers.argon2({
      variant: 'id',
      version: 0x13,
      iterations: app.inTest ? 2 : 3,
      memory: app.inTest ? 4096 : 65536,
      parallelism: app.inTest ? 1 : 4,
      saltSize: 16,
      hashLength: 32,
    }),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
