import { defineConfig } from '@foadonis/openapi'

/**
 * Generated API documentation, served at `/docs` outside production only
 * (see start/routes.ts). docs/backend/06-api-reference.md remains the contract
 * of record: when they disagree, the reference wins.
 */
export default defineConfig({
  ui: 'swagger',
  document: {
    info: {
      title: 'Konkouré API',
      version: 'v1',
      description:
        'Contrat de référence : docs/backend/06-api-reference.md. ' +
        'Routes `/org/*` : en-tête `X-Organization-Id` obligatoire.',
    },
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'opaque' },
      },
    },
    // Lets Swagger UI's Authorize button send the access token on every call.
    security: [{ bearer: [] }],
  },
})
