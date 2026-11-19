import { LocalizedMail } from '#modules/auth/mails/localized_mail'

/** Employee export ready (docs/backend/08 §9): signed link valid 24 hours. */
export class EmployeesExportMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { url: string; rows: number }
  ) {
    super(recipient)
  }

  prepare() {
    const data = { rows: String(this.details.rows) }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.employeesExport.subject'))
      .html(
        this.layout([this.greeting(), this.t('emails.employeesExport.body', data)], {
          label: this.t('emails.employeesExport.action'),
          url: this.details.url,
        })
      )
  }
}
