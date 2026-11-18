import { LocalizedMail } from '#modules/auth/mails/localized_mail'
import type { AppRole } from '#models/user_role'

/**
 * Invitation e-mail (docs/backend/08: organization, role, link, inviter). The
 * invitee may have no account yet: it is written in the organization language.
 */
export class InvitationMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { organization: string; inviter: string; role: AppRole; url: string }
  ) {
    super(recipient)
  }

  prepare() {
    const data = {
      organization: this.details.organization,
      inviter: this.details.inviter,
      role: this.t(`emails.roles.${this.details.role}`),
    }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.invitation.subject', data))
      .html(
        this.layout([this.t('emails.invitation.body', data)], {
          label: this.t('emails.invitation.action'),
          url: this.details.url,
        })
      )
  }
}
