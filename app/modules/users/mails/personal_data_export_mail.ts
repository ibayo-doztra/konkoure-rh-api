import { LocalizedMail } from '#modules/auth/mails/localized_mail'

/** Personal data export ready (docs/backend/05 §13): signed link valid 24 hours. */
export class PersonalDataExportMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { url: string }
  ) {
    super(recipient)
  }

  prepare() {
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.personalDataExport.subject'))
      .html(
        this.layout([this.greeting(), this.t('emails.personalDataExport.body')], {
          label: this.t('emails.personalDataExport.action'),
          url: this.details.url,
        })
      )
  }
}
