import { DateTime } from 'luxon'
import { LocalizedMail } from '#modules/auth/mails/localized_mail'

abstract class ReviewMail extends LocalizedMail {
  protected date(iso: string) {
    const locale = this.recipient.preferredLanguage === 'en' ? 'en' : 'fr'
    return DateTime.fromISO(iso, { zone: 'utc' })
      .setLocale(locale)
      .toLocaleString(DateTime.DATE_MED)
  }
}

/** `review_opened` (docs/backend/08 §4): to the employee, with the cycle and its deadline. */
export class ReviewOpenedMail extends ReviewMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { cycleName: string; deadline: string | null }
  ) {
    super(recipient)
  }

  prepare() {
    const data = { cycle: this.details.cycleName }
    const paragraphs = [this.greeting(), this.t('emails.reviewOpened.body', data)]
    if (this.details.deadline) {
      paragraphs.push(
        this.t('emails.reviewOpened.deadline', { date: this.date(this.details.deadline) })
      )
    }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.reviewOpened.subject', data))
      .html(this.layout(paragraphs))
  }
}

/** `review_sent_back` (08 §4): to the employee, with the manager's comment. */
export class ReviewSentBackMail extends ReviewMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { cycleName: string; comment: string }
  ) {
    super(recipient)
  }

  prepare() {
    const data = { cycle: this.details.cycleName, comment: this.details.comment }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.reviewSentBack.subject', data))
      .html(
        this.layout([
          this.greeting(),
          this.t('emails.reviewSentBack.body', data),
          this.t('emails.reviewSentBack.comment', data),
        ])
      )
  }
}

/** `review_signed` (08 §4): to the manager and HR, with the employee and the date. */
export class ReviewSignedMail extends ReviewMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { employeeName: string; signedAt: string }
  ) {
    super(recipient)
  }

  prepare() {
    const data = { employee: this.details.employeeName, date: this.date(this.details.signedAt) }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.reviewSigned.subject', data))
      .html(this.layout([this.greeting(), this.t('emails.reviewSigned.body', data)]))
  }
}
