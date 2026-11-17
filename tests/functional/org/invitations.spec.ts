import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import redis from '@adonisjs/redis/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import Invitation from '#models/invitation'
import type Organization from '#models/organization'
import type User from '#models/user'
import type { AppRole } from '#models/user_role'
import { InvitationMail } from '#modules/invitations/mails/invitation_mail'
import { apiLogin, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'
import { errorOf, expectStatus, untyped } from '#tests/helpers/http'
import { createInvitation, tokenFromMail } from '#tests/helpers/invitations'

interface Member {
  user: User
  accessToken: string
}

async function member(
  client: ApiClient,
  organization: Organization,
  roles: AppRole[]
): Promise<Member> {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  await grantRoles(user, organization, roles)
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken }
}

function asMember(
  client: ApiClient,
  method: 'get' | 'post' | 'delete',
  url: string,
  who: Member,
  organization: Organization
) {
  return client[method](url)
    .bearerToken(who.accessToken)
    .header('X-Organization-Id', organization.id)
}

test.group('Tenant middleware on /org/*', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('requires a valid X-Organization-Id header', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])

    const missing = await expectStatus(
      client.get('/api/v1/org/invitations').bearerToken(owner.accessToken),
      400
    )
    assert.equal(errorOf(missing).code, 'E_BAD_REQUEST')
    assert.equal(errorOf(missing).details[0].field, 'X-Organization-Id')

    await expectStatus(
      client
        .get('/api/v1/org/invitations')
        .bearerToken(owner.accessToken)
        .header('X-Organization-Id', 'not-a-uuid'),
      400
    )
  })

  test('refuses an organization the user does not belong to', async ({ client, assert }) => {
    const mine = await createOrganization('Mienne')
    const other = await createOrganization('Autre')
    const owner = await member(client, mine, ['owner'])

    const response = await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations', owner, other),
      403
    )
    assert.equal(errorOf(response).code, 'E_FORBIDDEN')
  })

  test('refuses an unverified e-mail', async ({ client, assert }) => {
    const org = await createOrganization()
    const user = await createUser()
    await grantRoles(user, org, ['owner'])
    const { accessToken } = await apiLogin(client, user.email)

    const response = await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations', { user, accessToken }, org),
      403
    )
    assert.equal(errorOf(response).code, 'E_EMAIL_NOT_VERIFIED')
  })

  test('requires authentication', async ({ client }) => {
    const org = await createOrganization()
    await expectStatus(
      client.get('/api/v1/org/invitations').header('X-Organization-Id', org.id),
      401
    )
  })
})

test.group('POST /api/v1/org/invitations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('invites an e-mail, audits it and mails a link', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const org = await createOrganization('Doztra')
    const owner = await member(client, org, ['owner'])

    const response = await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', owner, org).json({
        email: '  Aissatou.Bah@Doztra.test ',
        role: 'manager',
      }),
      201
    )
    const data = response.body().data
    assert.containSubset(data, {
      email: 'aissatou.bah@doztra.test',
      role: 'manager',
      status: 'pending',
      invitedBy: owner.user.id,
      sendCount: 1,
      acceptedAt: null,
    })
    assert.notProperty(data, 'tokenHash')
    const days = DateTime.fromISO(data.expiresAt).diffNow('days').days
    assert.isAbove(days, 6.9)
    assert.isBelow(days, 7.1)

    mails.assertQueued(InvitationMail)
    const token = tokenFromMail(mails, 'aissatou.bah@doztra.test')
    const stored = await Invitation.findOrFail(data.id)
    assert.notEqual(stored.tokenHash, token)

    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'invitation.sent')
      .firstOrFail()
    assert.equal(audit.actorUserId, owner.user.id)
    assert.equal(audit.actorRole, 'owner')
    assert.equal(audit.targetId, data.id)
  })

  test('hr_admin may invite but not hand out the owner role', async ({ client, assert }) => {
    mail.fake()
    const org = await createOrganization()
    const hr = await member(client, org, ['hr_admin'])

    await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', hr, org).json({
        email: 'rh@doztra.test',
        role: 'employee',
      }),
      201
    )
    const denied = await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', hr, org).json({
        email: 'boss@doztra.test',
        role: 'owner',
      }),
      403
    )
    assert.equal(errorOf(denied).code, 'E_FORBIDDEN')
  })

  test('other roles cannot invite', async ({ client, assert }) => {
    const org = await createOrganization()
    for (const roles of [
      ['manager'],
      ['employee'],
      ['recruiter'],
      ['security_agent'],
    ] as AppRole[][]) {
      const someone = await member(client, org, roles)
      const response = await expectStatus(
        asMember(client, 'post', '/api/v1/org/invitations', someone, org).json({
          email: 'x@doztra.test',
          role: 'employee',
        }),
        403
      )
      assert.equal(errorOf(response).code, 'E_FORBIDDEN')
    }
    assert.lengthOf(await Invitation.query().where('organization_id', org.id), 0)
  })

  test('refuses existing members and duplicate pending invitations', async ({ client, assert }) => {
    mail.fake()
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])
    const colleague = await createUser({ email: 'deja@doztra.test' })
    await grantRoles(colleague, org, ['employee'])

    const memberResponse = await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', owner, org).json({
        email: 'DEJA@doztra.test',
        role: 'manager',
      }),
      409
    )
    assert.equal(errorOf(memberResponse).details[0].rule, 'alreadyMember')

    const body = { email: 'nouveau@doztra.test', role: 'employee' as const }
    await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', owner, org).json(body),
      201
    )
    const duplicate = await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', owner, org).json(body),
      409
    )
    assert.equal(errorOf(duplicate).details[0].rule, 'pending')
  })

  test('replaces a pending invitation past its date', async ({ client, assert }) => {
    mail.fake()
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])
    const { invitation: old } = await createInvitation(org, {
      email: 'retard@doztra.test',
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', owner, org).json({
        email: 'retard@doztra.test',
        role: 'employee',
      }),
      201
    )
    await old.refresh()
    assert.equal(old.status, 'expired')
  })

  test('validates the input', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])

    const response = await expectStatus(
      asMember(client, 'post', '/api/v1/org/invitations', owner, org).json(
        untyped({ email: 'pas-un-email', role: 'root' })
      ),
      422
    )
    assert.sameMembers(
      errorOf(response).details.map((detail) => detail.field),
      ['email', 'role']
    )
  })

  test('replays the first response for a repeated Idempotency-Key', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])
    const key = crypto.randomUUID()
    const send = () =>
      asMember(client, 'post', '/api/v1/org/invitations', owner, org)
        .header('Idempotency-Key', key)
        .json({ email: 'une-fois@doztra.test', role: 'employee' })

    try {
      const first = await expectStatus(send(), 201)
      const second = await expectStatus(send(), 201)
      assert.equal(second.header('idempotent-replay'), 'true')
      assert.deepEqual(second.body(), first.body())
      assert.lengthOf(await Invitation.query().where('organization_id', org.id), 1)
      mails.assertQueuedCount(InvitationMail, 1)

      await expectStatus(
        asMember(client, 'post', '/api/v1/org/invitations', owner, org)
          .header('Idempotency-Key', 'pas-un-uuid')
          .json({ email: 'autre@doztra.test', role: 'employee' }),
        400
      )
    } finally {
      const keys = await redis.connection('cache').keys('cache:idempotency:*')
      if (keys.length) {
        await redis.connection('cache').del(...keys.map((k) => k.replace(/^cache:/, '')))
      }
    }
  })
})

test.group('GET /api/v1/org/invitations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists the organization invitations with pagination and status filter', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const other = await createOrganization('Autre')
    const hr = await member(client, org, ['hr_admin'])
    await createInvitation(org, { email: 'a@doztra.test' })
    await createInvitation(org, { email: 'b@doztra.test' })
    await createInvitation(org, {
      email: 'c@doztra.test',
      expiresAt: DateTime.now().minus({ hours: 1 }),
    })
    await createInvitation(other, { email: 'etranger@doztra.test' })

    const all = await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations?perPage=2', hr, org),
      200
    )
    assert.lengthOf(all.body().data, 2)
    assert.deepEqual(all.body().meta, { total: 3, perPage: 2, currentPage: 1, lastPage: 2 })

    const expired = await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations?filter[status]=expired', hr, org),
      200
    )
    assert.deepEqual(
      expired.body().data.map((row: { email: string; status: string }) => [row.email, row.status]),
      [['c@doztra.test', 'expired']]
    )

    const pending = await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations?filter[status]=pending', hr, org),
      200
    )
    assert.sameMembers(
      pending.body().data.map((row: { email: string }) => row.email),
      ['a@doztra.test', 'b@doztra.test']
    )
  })

  test('is reserved to owner and hr_admin', async ({ client }) => {
    const org = await createOrganization()
    const manager = await member(client, org, ['manager'])
    await expectStatus(asMember(client, 'get', '/api/v1/org/invitations', manager, org), 403)
  })

  test('validates pagination and filters', async ({ client }) => {
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])
    await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations?perPage=500', owner, org),
      422
    )
    await expectStatus(
      asMember(client, 'get', '/api/v1/org/invitations?filter[status]=lost', owner, org),
      422
    )
  })
})

test.group('Resend and revoke /api/v1/org/invitations/:id', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('resend issues a new link, invalidates the old one, 3 per 24 h', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])
    const { invitation, token: oldToken } = await createInvitation(org, {
      email: 'relance@doztra.test',
      expiresAt: DateTime.now().minus({ days: 1 }),
    })
    const url = `/api/v1/org/invitations/${invitation.id}/resend`

    const response = await expectStatus(asMember(client, 'post', url, owner, org), 200)
    assert.equal(response.body().data.status, 'pending')
    assert.equal(response.body().data.sendCount, 2)

    await expectStatus(client.get(`/api/v1/auth/invitations/${oldToken}`), 404)
    const newToken = tokenFromMail(mails, 'relance@doztra.test')
    await expectStatus(client.get(`/api/v1/auth/invitations/${newToken}`), 200)

    await expectStatus(asMember(client, 'post', url, owner, org), 200)
    await expectStatus(asMember(client, 'post', url, owner, org), 200)
    const limited = await expectStatus(asMember(client, 'post', url, owner, org), 429)
    assert.equal(errorOf(limited).code, 'E_RATE_LIMITED')
  })

  test('revoke closes the link; a second revoke conflicts', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await member(client, org, ['owner'])
    const { invitation, token } = await createInvitation(org)
    const url = `/api/v1/org/invitations/${invitation.id}`

    await expectStatus(asMember(client, 'delete', url, owner, org), 204)
    await invitation.refresh()
    assert.equal(invitation.status, 'revoked')
    await expectStatus(client.get(`/api/v1/auth/invitations/${token}`), 404)

    const again = await expectStatus(asMember(client, 'delete', url, owner, org), 409)
    assert.equal(errorOf(again).details[0].rule, 'notPending')
    await expectStatus(asMember(client, 'post', `${url}/resend`, owner, org), 409)

    assert.isNotNull(
      await AuditLog.query()
        .where('action', 'invitation.revoked')
        .where('target_id', invitation.id)
        .first()
    )
  })

  test('an invitation of another organization is not found', async ({ client, assert }) => {
    const org = await createOrganization()
    const other = await createOrganization('Autre')
    const owner = await member(client, org, ['owner'])
    const { invitation } = await createInvitation(other)

    const revoke = await expectStatus(
      asMember(client, 'delete', `/api/v1/org/invitations/${invitation.id}`, owner, org),
      404
    )
    assert.equal(errorOf(revoke).code, 'E_NOT_FOUND')
    await expectStatus(
      asMember(client, 'post', `/api/v1/org/invitations/${invitation.id}/resend`, owner, org),
      404
    )
    await invitation.refresh()
    assert.equal(invitation.status, 'pending')
  })

  test('is reserved to owner and hr_admin and validates the id', async ({ client }) => {
    const org = await createOrganization()
    const employee = await member(client, org, ['employee'])
    const owner = await member(client, org, ['owner'])
    const { invitation } = await createInvitation(org)

    await expectStatus(
      asMember(client, 'delete', `/api/v1/org/invitations/${invitation.id}`, employee, org),
      403
    )
    await expectStatus(asMember(client, 'delete', '/api/v1/org/invitations/123', owner, org), 422)
  })
})

test.group('Public invitation flow /api/v1/auth/invitations/:token', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('previews a usable invitation only', async ({ client, assert }) => {
    const org = await createOrganization('Doztra')
    const { token } = await createInvitation(org, { email: 'voir@doztra.test', role: 'recruiter' })

    const response = await expectStatus(client.get(`/api/v1/auth/invitations/${token}`), 200)
    assert.containSubset(response.body().data, {
      organizationName: 'Doztra',
      email: 'voir@doztra.test',
      role: 'recruiter',
      accountExists: false,
    })

    const { token: expired } = await createInvitation(org, {
      expiresAt: DateTime.now().minus({ minutes: 1 }),
    })
    await expectStatus(client.get(`/api/v1/auth/invitations/${expired}`), 404)
    await expectStatus(client.get(`/api/v1/auth/invitations/${'x'.repeat(43)}`), 404)
  })

  test('creates a verified account, grants the role and opens a session', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization('Doztra')
    const { invitation, token } = await createInvitation(org, {
      email: 'nouvelle@doztra.test',
      role: 'manager',
    })

    const response = await expectStatus(
      client.post(`/api/v1/auth/invitations/${token}/accept`).json(
        untyped({
          password: 'Konakry-Rh-2026',
          password_confirmation: 'Konakry-Rh-2026',
          fullName: 'Fatoumata Diallo',
        })
      ),
      200
    )
    const data = response.body().data
    assert.containSubset(data.user, {
      email: 'nouvelle@doztra.test',
      fullName: 'Fatoumata Diallo',
      emailVerified: true,
    })
    assert.isString(data.accessToken)
    assert.deepEqual(data.organizations, [
      { id: org.id, name: 'Doztra', slug: org.slug, logoUrl: null, roles: ['manager'] },
    ])
    assert.match(String(response.header('set-cookie')), /konkoure_refresh=/)

    await invitation.refresh()
    assert.equal(invitation.status, 'accepted')
    assert.equal(invitation.acceptedUserId, data.user.id)

    const actions = await AuditLog.query()
      .where('organization_id', org.id)
      .whereIn('action', ['invitation.accepted', 'role.granted'])
      .select('action')
    assert.sameMembers(
      actions.map((row) => row.action),
      ['invitation.accepted', 'role.granted']
    )

    const reuse = await expectStatus(
      client
        .post(`/api/v1/auth/invitations/${token}/accept`)
        .json(untyped({ password: 'Konakry-Rh-2026', password_confirmation: 'Konakry-Rh-2026' })),
      404
    )
    assert.equal(errorOf(reuse).code, 'E_NOT_FOUND')
  })

  test('applies the password policy to new accounts', async ({ client, assert }) => {
    const org = await createOrganization()
    const { invitation, token } = await createInvitation(org)

    const response = await expectStatus(
      client
        .post(`/api/v1/auth/invitations/${token}/accept`)
        .json(untyped({ password: 'faible', password_confirmation: 'faible' })),
      422
    )
    assert.equal(errorOf(response).details[0].rule, 'composition')
    await invitation.refresh()
    assert.equal(invitation.status, 'pending')
  })

  test('an existing account proves its password and only gains the role', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization('Doztra')
    const elsewhere = await createOrganization('Ailleurs')
    const existing = await createUser({ email: 'deja-compte@doztra.test' })
    await grantRoles(existing, elsewhere, ['owner'])
    const { invitation, token } = await createInvitation(org, {
      email: 'deja-compte@doztra.test',
      role: 'employee',
    })

    const preview = await expectStatus(client.get(`/api/v1/auth/invitations/${token}`), 200)
    assert.isTrue(preview.body().data.accountExists)

    const wrong = await expectStatus(
      client
        .post(`/api/v1/auth/invitations/${token}/accept`)
        .json(untyped({ password: 'Mauvais-Mot-2026', password_confirmation: 'Mauvais-Mot-2026' })),
      401
    )
    assert.equal(errorOf(wrong).code, 'E_UNAUTHORIZED')
    await invitation.refresh()
    assert.equal(invitation.status, 'pending')

    const response = await expectStatus(
      client
        .post(`/api/v1/auth/invitations/${token}/accept`)
        .json(untyped({ password: 'Konakry-Rh-2026', password_confirmation: 'Konakry-Rh-2026' })),
      200
    )
    assert.equal(response.body().data.user.id, existing.id)
    assert.isTrue(response.body().data.user.emailVerified)
    assert.sameDeepMembers(
      response
        .body()
        .data.organizations.map((o: { name: string; roles: string[] }) => [o.name, o.roles]),
      [
        ['Ailleurs', ['owner']],
        ['Doztra', ['employee']],
      ]
    )
  })

  test('validates the accept body', async ({ client, assert }) => {
    const org = await createOrganization()
    const { token } = await createInvitation(org)

    const response = await expectStatus(
      client
        .post(`/api/v1/auth/invitations/${token}/accept`)
        .json(untyped({ password: 'Konakry-Rh-2026', password_confirmation: 'Different-2026' })),
      422
    )
    assert.equal(errorOf(response).details[0].field, 'password_confirmation')
  })
})
