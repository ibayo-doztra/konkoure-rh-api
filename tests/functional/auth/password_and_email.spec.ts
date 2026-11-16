import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import encryption from '@adonisjs/core/services/encryption'
import mail from '@adonisjs/mail/services/main'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import PasswordResetToken from '#models/password_reset_token'
import { sha256 } from '#shared/utils/crypto'
import { ResetPasswordMail, VerifyEmailMail } from '#modules/auth/mails/localized_mail'
import { apiLogin, createUser } from '#tests/helpers/auth'
import { expectStatus, untyped } from '#tests/helpers/http'

const NEW_PASSWORD = 'Nouveau-Mot-2026'

async function resetToken(userId: string, expiresAt = DateTime.now().plus({ hours: 1 })) {
  const token = `reset-${Math.random().toString(36).slice(2)}-token`
  await PasswordResetToken.create({ userId, tokenHash: sha256(token), expiresAt })
  return token
}

test.group('Forgotten and reset password', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('POST /auth/forgot-password always answers 204 and only mails known accounts', async ({
    client,
  }) => {
    const { mails } = mail.fake()
    await expectStatus(
      client.post('/api/v1/auth/forgot-password').json({ email: 'ghost@doztra.test' }),
      204
    )
    mails.assertNoneQueued()

    await createUser({ email: 'known@doztra.test' })
    await expectStatus(
      client.post('/api/v1/auth/forgot-password').json({ email: 'known@doztra.test' }),
      204
    )
    mails.assertQueued(ResetPasswordMail)
  })

  test('limits reset requests to 3 per hour and per e-mail', async ({ client }) => {
    const request = () =>
      client.post('/api/v1/auth/forgot-password').json({ email: 'spam@doztra.test' })
    for (let i = 0; i < 3; i++) await expectStatus(request(), 204)
    await expectStatus(request(), 429)
  })

  test('POST /auth/reset-password sets the password, revokes sessions and is single-use', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ failedLoginAttempts: 3 })
    const session = await apiLogin(client, user.email)
    const token = await resetToken(user.id)
    const reset = () =>
      client
        .post('/api/v1/auth/reset-password')
        .json(untyped({ token, password: NEW_PASSWORD, password_confirmation: NEW_PASSWORD }))

    await expectStatus(reset(), 204)

    await user.refresh()
    const passwordMatches = await hash.verify(user.passwordHash!, NEW_PASSWORD)
    assert.isTrue(passwordMatches)
    assert.equal(user.failedLoginAttempts, 0)
    await expectStatus(client.get('/api/v1/me').bearerToken(session.accessToken), 401)
    const audit = await AuditLog.query().where('action', 'auth.password_reset')
    assert.lengthOf(audit, 1)

    const reused = await expectStatus(reset(), 422)
    assert.equal(reused.body().error.details[0].field, 'token')
  })

  test('refuses an expired reset link', async ({ client }) => {
    const user = await createUser()
    const token = await resetToken(user.id, DateTime.now().minus({ minutes: 1 }))
    await expectStatus(
      client
        .post('/api/v1/auth/reset-password')
        .json(untyped({ token, password: NEW_PASSWORD, password_confirmation: NEW_PASSWORD })),
      422
    )
  })
})

test.group('E-mail verification', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('POST /auth/verify-email verifies the address of a signed token', async ({
    client,
    assert,
  }) => {
    const user = await createUser()
    const token = encryption.encrypt(
      { userId: user.id, email: user.email },
      '24h',
      'email-verification'
    )
    await expectStatus(client.post('/api/v1/auth/verify-email').json({ token }), 204)
    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('rejects a token signed for another address or tampered with', async ({ client }) => {
    const user = await createUser()
    const stale = encryption.encrypt(
      { userId: user.id, email: 'old@doztra.test' },
      '24h',
      'email-verification'
    )
    await expectStatus(client.post('/api/v1/auth/verify-email').json({ token: stale }), 422)
    await expectStatus(
      client.post('/api/v1/auth/verify-email').json({ token: 'not-a-valid-token-at-all' }),
      422
    )
  })

  test('POST /auth/resend-verification sends at most 3 e-mails per 24 h', async ({ client }) => {
    const { mails } = mail.fake()
    const user = await createUser()
    const { accessToken } = await apiLogin(client, user.email)
    const resend = () => client.post('/api/v1/auth/resend-verification').bearerToken(accessToken)

    for (let i = 0; i < 3; i++) await expectStatus(resend(), 204)
    mails.assertQueuedCount(VerifyEmailMail, 3)
    await expectStatus(resend(), 429)
  })
})
