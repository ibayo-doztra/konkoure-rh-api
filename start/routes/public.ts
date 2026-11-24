import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleCareers, throttlePublicPayments, throttleUser } from '#start/limiter'

const CareersController = () => import('#modules/recruitment/controllers/careers_controller')
const N8nWebhookController = () => import('#modules/recruitment/controllers/n8n_webhook_controller')
const DjomyWebhookController = () => import('#modules/billing/controllers/djomy_webhook_controller')
const PublicPaymentsController = () =>
  import('#modules/billing/controllers/public_payments_controller')

/**
 * `/api/v1/public/*` — 06-api-reference §11, unauthenticated (05 §4). Each
 * route resolves its organization itself; nothing here trusts a header.
 */
export function registerPublicRoutes() {
  router
    .group(() => {
      router.get(':orgSlug', [CareersController, 'page']).as('show')
      router.get(':orgSlug/jobs/:jobSlug', [CareersController, 'job']).as('jobs.show')
      router
        .post(':orgSlug/jobs/:jobSlug/apply/check', [CareersController, 'check'])
        .as('jobs.apply.check')
      router.post(':orgSlug/jobs/:jobSlug/apply', [CareersController, 'apply']).as('jobs.apply')
    })
    .prefix('public/careers')
    .as('public.careers')
    .use(throttleCareers)

  router
    .get('public/plans', [PublicPaymentsController, 'plans'])
    .as('public.plans')
    .use(throttleCareers)

  /** Payment before sign-up (06 §11, 07 §7.7). The claim needs the signed-up payer. */
  router
    .group(() => {
      router.post('checkout', [PublicPaymentsController, 'checkout']).as('checkout')
      router.get(':ref', [PublicPaymentsController, 'show']).as('show')
    })
    .prefix('public/payments')
    .as('public.payments')
    .use(throttlePublicPayments)
  router
    .post('public/payments/:ref/claim', [PublicPaymentsController, 'claim'])
    .as('public.payments.claim')
    .use([middleware.auth(), throttleUser])

  /** Inbound webhooks (06 §12): signed by the sender, never authenticated by a session. */
  router.post('webhooks/n8n/scoring', [N8nWebhookController, 'scoring']).as('webhooks.n8n.scoring')
  router.post('webhooks/djomy/:token', [DjomyWebhookController, 'handle']).as('webhooks.djomy')
}
