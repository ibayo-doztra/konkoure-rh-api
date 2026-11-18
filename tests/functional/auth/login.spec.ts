import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import { ResetPasswordMail } from '#modules/auth/mails/localized_mail'
import { expectStatus, untyped } from '#tests/helpers/http'
import { STRONG_PASSWORD, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'

async function auditCount(action: string) {
  const rows = await AuditLog.query().where('action', action)
  return rows.length
}

test.group('POST /api/v1/auth/login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('returns tokens, the user and their organizations with roles', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ email: 'owner@doztra.test' })
    const org = await createOrganization('Doztra')
    await grantRoles(user, org, ['owner', 'hr_admin'])

    const response = await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'OWNER@doztra.test', password: STRONG_PASSWORD }),
      200
    )
    const data = response.body().data
    assert.match(data.accessToken, /^oat_/)
    assert.match(data.refreshToken, /^rt_/)
    assert.deepEqual(data.organizations, [
      { id: org.id, name: org.name, slug: org.slug, logoUrl: null, roles: ['owner', 'hr_admin'] },
    ])
    await user.refresh()
    assert.isNotNull(user.lastLoginAt)
    assert.equal(await auditCount('auth.login'), 1)
  })

  test('answers identically for a wrong password and an unknown e-mail', async ({
    client,
    assert,
  }) => {
    await createUser({ email: 'known@doztra.test' })
    const wrong = await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'known@doztra.test', password: 'Not-The-Password-1' }),
      401
    )
    const unknown = await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'ghost@doztra.test', password: 'Not-The-Password-1' }),
      401
    )
    assert.equal(wrong.body().error.code, 'E_UNAUTHORIZED')
    assert.equal(wrong.body().error.message, unknown.body().error.message)
    assert.equal(await auditCount('auth.login_failed'), 2)
  })

  test('locks the account at the 5th failure, even for the right password', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ email: 'locked@doztra.test' })
    const attempt = (password: string) =>
      client.post('/api/v1/auth/login').json({ email: 'locked@doztra.test', password })

    for (let i = 0; i < 4; i++) await expectStatus(attempt('Wrong-Password-9'), 401)
    await expectStatus(attempt('Wrong-Password-9'), 423)

    await user.refresh()
    assert.isTrue(user.lockedUntil! > DateTime.now())
    assert.equal(await auditCount('auth.account_locked'), 1)

    // The per-e-mail budget (5 / 15 min) is now exhausted as well.
    const afterLock = await expectStatus(attempt(STRONG_PASSWORD), 429)
    assert.exists(afterLock.header('retry-after'))
  })

  test('refuses a locked account with E_ACCOUNT_LOCKED', async ({ client }) => {
    await createUser({
      email: 'still-locked@doztra.test',
      lockedUntil: DateTime.now().plus({ minutes: 10 }),
    })
    const response = await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'still-locked@doztra.test', password: STRONG_PASSWORD }),
      423
    )
    response.assertBodyContains({ error: { code: 'E_ACCOUNT_LOCKED' } })
  })

  test('limits failures to 10 per IP', async ({ client }) => {
    for (let i = 0; i < 10; i++) {
      await expectStatus(
        client
          .post('/api/v1/auth/login')
          .json({ email: `nobody${i}@doztra.test`, password: 'Wrong-Password-9' }),
        401
      )
    }
    const blocked = await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'nobody-else@doztra.test', password: 'Wrong-Password-9' }),
      429
    )
    blocked.assertBodyContains({ error: { code: 'E_RATE_LIMITED' } })
  })

  test('requires a password reset for imported accounts and e-mails the link', async ({
    client,
  }) => {
    const { mails } = mail.fake()
    await createUser({ email: 'legacy@doztra.test', mustResetPassword: true, passwordHash: null })
    const response = await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'legacy@doztra.test', password: 'Anything-1234' }),
      409
    )
    response.assertBodyContains({ error: { code: 'E_PASSWORD_RESET_REQUIRED' } })
    mails.assertQueued(ResetPasswordMail)
  })

  test('refuses deactivated accounts', async ({ client }) => {
    await createUser({ email: 'inactive@doztra.test', isActive: false })
    await expectStatus(
      client
        .post('/api/v1/auth/login')
        .json({ email: 'inactive@doztra.test', password: STRONG_PASSWORD }),
      401
    )
  })

  test('validates the payload', async ({ client }) => {
    const response = await expectStatus(
      client.post('/api/v1/auth/login').json(untyped({ email: 'not-an-email' })),
      422
    )
    response.assertBodyContains({ error: { code: 'E_VALIDATION' } })
  })
})
