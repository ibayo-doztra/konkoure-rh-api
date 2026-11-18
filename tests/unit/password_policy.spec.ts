import { test } from '@japa/runner'
import { AppException } from '#shared/exceptions/app_exception'
import { assertStrongPassword } from '#modules/auth/services/password_policy'

const identity = { email: 'mariama.camara@doztra.test', fullName: 'Mariama Camara' }

function ruleOf(password: string) {
  try {
    assertStrongPassword(password, identity)
    return null
  } catch (error) {
    return error instanceof AppException ? error.details[0]?.rule : 'unexpected'
  }
}

test.group('Password policy (docs/backend/04 §2)', () => {
  test('accepts a strong, personal-free password', ({ assert }) => {
    assert.isNull(ruleOf('Konakry-Rh-2026'))
  })

  test('requires a lowercase, an uppercase and a digit', ({ assert }) => {
    assert.equal(ruleOf('alllowercase2026'), 'composition')
    assert.equal(ruleOf('ALLUPPERCASE2026'), 'composition')
    assert.equal(ruleOf('NoDigitsAtAllHere'), 'composition')
  })

  test('refuses the most common passwords, case-insensitively', ({ assert }) => {
    assert.equal(ruleOf('Qwerty123'), 'common')
  })

  test('refuses passwords containing the e-mail or the name', ({ assert }) => {
    assert.equal(ruleOf('Mariama-2026x'), 'personal')
    assert.equal(ruleOf('XCamara2026y'), 'personal')
  })
})
