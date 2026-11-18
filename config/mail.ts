import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'
import type { InferMailers } from '@adonisjs/mail/types'

/**
 * Transactional e-mail through Resend (docs/backend/00 §3, 08).
 * Sender: `Konkouré <support@konkoure.doztra.cloud>` (00-HANDOFF §4).
 * Tests replace the mailer with `mail.fake()`.
 */
const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  mailers: {
    resend: transports.resend({
      key: env.get('RESEND_API_KEY')?.release() ?? '',
      baseUrl: 'https://api.resend.com',
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
