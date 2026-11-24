import type DemoRequest from '#models/demo_request'
import { LocalizedMail } from '#modules/auth/mails/localized_mail'

/** `demo_request` (docs/backend/08 §4): to the sales team, in French. */
export class DemoRequestMail extends LocalizedMail {
  constructor(
    to: string,
    private request: DemoRequest
  ) {
    super({ email: to, fullName: null, preferredLanguage: 'fr' })
  }

  prepare() {
    const { request } = this
    const data = {
      company: request.companyName,
      size: request.companySize,
      name: request.fullName,
      email: request.email,
      phone: request.phone,
      message: request.message ?? '—',
    }
    this.message
      .to(this.recipient.email)
      .replyTo(request.email)
      .subject(this.t('emails.demoRequest.subject', data))
      .html(
        this.layout([
          this.t('emails.demoRequest.intro', data),
          this.t('emails.demoRequest.contact', data),
          this.t('emails.demoRequest.message', data),
        ])
      )
  }
}
