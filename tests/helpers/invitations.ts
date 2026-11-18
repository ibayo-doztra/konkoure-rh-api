import { DateTime } from 'luxon'
import type { FakeMailer } from '@adonisjs/mail'
import Invitation from '#models/invitation'
import type Organization from '#models/organization'
import type { AppRole } from '#models/user_role'
import { InvitationMail } from '#modules/invitations/mails/invitation_mail'
import { randomToken, sha256 } from '#shared/utils/crypto'

type Mails = FakeMailer['mails']

/** Invitation row with a known token, as if sent by the API. */
export async function createInvitation(
  organization: Organization,
  overrides: Partial<Pick<Invitation, 'email' | 'role' | 'status' | 'expiresAt'>> = {}
) {
  const token = randomToken(32)
  const invitation = await Invitation.create({
    organizationId: organization.id,
    email: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@konkoure.test`,
    role: 'employee' as AppRole,
    tokenHash: sha256(token),
    expiresAt: DateTime.now().plus({ days: 7 }),
    invitedBy: null,
    ...overrides,
  })
  return { invitation, token }
}

/** Token of the last invitation e-mail queued to `email`. */
export function tokenFromMail(mails: Mails, email: string): string {
  const queued = mails
    .queued((mail) => mail instanceof InvitationMail)
    .map((mail) => mail.message.toJSON().message)
    .filter((message) => JSON.stringify(message.to).includes(email))
  const html = String(queued.at(-1)?.html ?? '')
  const match = /\/invitation\?token=([A-Za-z0-9_%-]+)/.exec(html)
  if (!match) throw new Error(`No invitation e-mail queued to ${email}`)
  return decodeURIComponent(match[1])
}
