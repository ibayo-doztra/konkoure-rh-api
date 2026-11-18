import type { HttpContext } from '@adonisjs/core/http'
import healthService from '#modules/health/services/health_service'

/** Liveness and readiness probes (docs/backend/06 §14). */
export default class HealthController {
  show() {
    return healthService.liveness()
  }

  async ready({ response }: HttpContext) {
    const { ready, body } = await healthService.readiness()
    return response.status(ready ? 200 : 503).send(body)
  }
}
