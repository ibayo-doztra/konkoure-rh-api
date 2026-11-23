import { LocalizedMail } from '#modules/auth/mails/localized_mail'

/** `candidate_applied` (docs/backend/08 §4): to the recruiters, with the offer and the candidate. */
export class CandidateAppliedMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { jobTitle: string; candidateName: string }
  ) {
    super(recipient)
  }

  prepare() {
    const data = { job: this.details.jobTitle, candidate: this.details.candidateName }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.candidateApplied.subject', data))
      .html(this.layout([this.greeting(), this.t('emails.candidateApplied.body', data)]))
  }
}

/** `application_received` (08 §4): acknowledgment to the candidate, in the organization's language. */
export class ApplicationReceivedMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { jobTitle: string; organizationName: string }
  ) {
    super(recipient)
  }

  prepare() {
    const data = { job: this.details.jobTitle, organization: this.details.organizationName }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.applicationReceived.subject', data))
      .html(this.layout([this.greeting(), this.t('emails.applicationReceived.body', data)]))
  }
}
