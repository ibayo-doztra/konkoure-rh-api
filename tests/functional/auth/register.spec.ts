import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import { VerifyEmailMail } from '#modules/auth/mails/localized_mail'
import { STRONG_PASSWORD, createUser } from '#tests/helpers/auth'
import { errorOf, untyped } from '#tests/helpers/http'

const payload = (overrides: Record<string, unknown> = {}) =>
  untyped({
    email: 'Aissatou.Bah@Doztra.test',
    password: STRONG_PASSWORD,
    password_confirmation: STRONG_PASSWORD,
    fullName: 'Aïssatou Bah',
    acceptTerms: true,
    ...overrides,
  })

test.group('POST /api/v1/auth/register', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creates an unverified account, opens a session and sends the verification e-mail', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const response = await client.post('/api/v1/auth/register').json(payload())

    response.assertStatus(201)
    const data = response.body().data
    assert.equal(data.user.email, 'aissatou.bah@doztra.test')
    assert.isFalse(data.user.emailVerified)
    assert.match(data.accessToken, /^oat_/)
    assert.match(data.refreshToken, /^rt_/)
    assert.equal(data.expiresIn, 900)
    assert.deepEqual(data.organizations, [])
    assert.notProperty(data.user, 'passwordHash')
    assert.exists(response.cookie('konkoure_refresh'))

    const user = await User.findByOrFail('email', 'aissatou.bah@doztra.test')
    assert.isNull(user.emailVerifiedAt)
    assert.match(user.passwordHash!, /^\$argon2id\$/)
    mails.assertQueued(VerifyEmailMail)
  })

  test('refuses an e-mail already used with a generic conflict', async ({ client }) => {
    await createUser({ email: 'taken@doztra.test' })
    const response = await client
      .post('/api/v1/auth/register')
      .json(payload({ email: 'TAKEN@doztra.test' }))
    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_CONFLICT' } })
  })

  test('rejects missing consent, weak and common passwords with E_VALIDATION', async ({
    client,
    assert,
  }) => {
    const noTerms = await client.post('/api/v1/auth/register').json(payload({ acceptTerms: false }))
    noTerms.assertStatus(422)
    assert.equal(errorOf(noTerms).details[0].field, 'acceptTerms')

    const weak = await client
      .post('/api/v1/auth/register')
      .json(payload({ password: 'alllowercase1', password_confirmation: 'alllowercase1' }))
    weak.assertStatus(422)
    assert.equal(errorOf(weak).details[0].rule, 'composition')

    const personal = await client
      .post('/api/v1/auth/register')
      .json(payload({ password: 'Aissatou2026X', password_confirmation: 'Aissatou2026X' }))
    personal.assertStatus(422)
    assert.equal(errorOf(personal).details[0].rule, 'personal')
  })

  test('returns the canonical error shape with a request id, in the requested language', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/v1/auth/register')
      .header('Accept-Language', 'en')
      .json(untyped({}))
    response.assertStatus(422)
    const error = errorOf(response)
    assert.equal(error.code, 'E_VALIDATION')
    assert.equal(error.message, 'The submitted data is invalid.')
    assert.equal(error.requestId, response.header('x-request-id'))
    assert.isAbove(error.details.length, 0)
  })
})
