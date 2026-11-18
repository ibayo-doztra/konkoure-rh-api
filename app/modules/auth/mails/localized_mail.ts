import { BaseMail } from '@adonisjs/mail'
import i18nManager from '@adonisjs/i18n/services/main'

/**
 * Base for transactional e-mails, rendered in the recipient's language
 * (`users.preferred_language`, fr by default). Plain HTML: no template engine.
 */
export abstract class LocalizedMail extends BaseMail {
  constructor(
    protected recipient: { email: string; fullName: string | null; preferredLanguage: string }
  ) {
    super()
  }

  protected t(key: string, data: Record<string, string> = {}) {
    const locale = this.recipient.preferredLanguage === 'en' ? 'en' : 'fr'
    return i18nManager.locale(locale).t(key, data)
  }

  protected layout(paragraphs: string[], action?: { label: string; url: string }) {
    const escape = (value: string) =>
      value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
    const body = paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')
    const button = action
      ? `<p><a href="${escape(action.url)}" style="background:#0F7A5A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escape(action.label)}</a></p><p style="font-size:12px;color:#666">${escape(action.url)}</p>`
      : ''
    return `<div style="font-family:Roboto,Helvetica,Arial,sans-serif;max-width:560px">${body}${button}<p style="font-size:12px;color:#666">Konkouré</p></div>`
  }

  protected greeting() {
    return this.t('emails.greeting', { name: this.recipient.fullName ?? '' })
  }
}

export class VerifyEmailMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private url: string
  ) {
    super(recipient)
  }

  prepare() {
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.verify.subject'))
      .html(
        this.layout([this.greeting(), this.t('emails.verify.body')], {
          label: this.t('emails.verify.action'),
          url: this.url,
        })
      )
  }
}

export class ResetPasswordMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private url: string
  ) {
    super(recipient)
  }

  prepare() {
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.reset.subject'))
      .html(
        this.layout([this.greeting(), this.t('emails.reset.body')], {
          label: this.t('emails.reset.action'),
          url: this.url,
        })
      )
  }
}

/** Sent when a consumed refresh token is presented again (docs/backend/04 §1). */
export class SessionCompromisedMail extends LocalizedMail {
  prepare() {
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.sessionCompromised.subject'))
      .html(this.layout([this.greeting(), this.t('emails.sessionCompromised.body')]))
  }
}
