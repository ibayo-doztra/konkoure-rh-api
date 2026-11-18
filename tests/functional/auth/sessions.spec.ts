import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import AuthRefreshToken from '#models/auth_refresh_token'
import { SessionCompromisedMail } from '#modules/auth/mails/localized_mail'
import { apiLogin, createUser } from '#tests/helpers/auth'
import { expectStatus } from '#tests/helpers/http'

test.group('Session lifecycle: refresh, reuse detection, logout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('POST /auth/refresh rotates the pair and retires the previous access token', async ({
    client,
    assert,
  }) => {
    const user = await createUser()
    const first = await apiLogin(client, user.email)

    const refreshed = await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: first.refreshToken }),
      200
    )
    const second = refreshed.body().data
    assert.notEqual(second.refreshToken, first.refreshToken)
    assert.notEqual(second.accessToken, first.accessToken)

    await expectStatus(client.get('/api/v1/me').bearerToken(first.accessToken), 401)
    await expectStatus(client.get('/api/v1/me').bearerToken(second.accessToken), 200)
  })

  test('accepts the refresh token from the httpOnly cookie (web client)', async ({ client }) => {
    const user = await createUser()
    const first = await apiLogin(client, user.email)
    await expectStatus(
      client.post('/api/v1/auth/refresh').withCookie('konkoure_refresh', first.refreshToken),
      200
    )
  })

  test('replaying a consumed refresh token revokes the whole family', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const user = await createUser()
    const first = await apiLogin(client, user.email)
    const rotated = await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: first.refreshToken }),
      200
    )
    const second = rotated.body().data

    await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: first.refreshToken }),
      401
    )

    // The legitimate successor is revoked too, and its access token is gone.
    await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: second.refreshToken }),
      401
    )
    await expectStatus(client.get('/api/v1/me').bearerToken(second.accessToken), 401)

    const open = await AuthRefreshToken.query().where('user_id', user.id).whereNull('revoked_at')
    assert.lengthOf(open, 0)
    // Presenting a consumed *or revoked* token is a reuse (docs/backend/04 §1): the
    // replay and the revoked successor are both journaled.
    const audit = await AuditLog.query().where('action', 'security.refresh_reuse_detected')
    assert.lengthOf(audit, 2)
    mails.assertQueued(SessionCompromisedMail)
  })

  test('rejects an unknown refresh token and a missing one', async ({ client }) => {
    await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: 'rt_unknown-token-value' }),
      401
    )
    await expectStatus(client.post('/api/v1/auth/refresh').json({}), 401)
  })

  test('POST /auth/logout closes only the current session', async ({ client }) => {
    const user = await createUser()
    const web = await apiLogin(client, user.email)
    const mobile = await apiLogin(client, user.email)

    await expectStatus(client.post('/api/v1/auth/logout').bearerToken(web.accessToken), 204)
    await expectStatus(client.get('/api/v1/me').bearerToken(web.accessToken), 401)
    await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: web.refreshToken }),
      401
    )
    await expectStatus(client.get('/api/v1/me').bearerToken(mobile.accessToken), 200)
  })

  test('POST /auth/logout-all closes every session', async ({ client }) => {
    const user = await createUser()
    const a = await apiLogin(client, user.email)
    const b = await apiLogin(client, user.email)

    await expectStatus(client.post('/api/v1/auth/logout-all').bearerToken(a.accessToken), 204)
    await expectStatus(client.get('/api/v1/me').bearerToken(b.accessToken), 401)
    await expectStatus(
      client.post('/api/v1/auth/refresh').json({ refreshToken: b.refreshToken }),
      401
    )
  })

  test('an expired access token answers E_TOKEN_EXPIRED', async ({ client }) => {
    const user = await createUser()
    const session = await apiLogin(client, user.email)
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .update({ expires_at: new Date(Date.now() - 1000) })

    const response = await expectStatus(
      client.get('/api/v1/me').bearerToken(session.accessToken),
      401
    )
    response.assertBodyContains({ error: { code: 'E_TOKEN_EXPIRED' } })
  })

  test('logout requires authentication', async ({ client }) => {
    const response = await expectStatus(client.post('/api/v1/auth/logout'), 401)
    response.assertBodyContains({ error: { code: 'E_UNAUTHORIZED' } })
  })
})
