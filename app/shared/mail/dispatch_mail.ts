import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import type { BaseMail } from '@adonisjs/mail'

/**
 * Queues an e-mail after the business transaction has committed. A delivery
 * problem (provider down, missing RESEND_API_KEY in local development) is logged
 * and never fails the request that triggered it (docs/backend/01 §1, 08).
 */
export async function dispatchMail(message: BaseMail) {
  try {
    await mail.sendLater(message)
  } catch (error) {
    logger.error({ err: error, mail: message.constructor.name }, 'mail.dispatch_failed')
  }
}
