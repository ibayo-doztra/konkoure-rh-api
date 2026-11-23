import { test } from '@japa/runner'
import { careersJobUrl } from '#modules/recruitment/careers_urls'
import { authSettings } from '#modules/auth/auth_settings'

test.group('careersJobUrl', () => {
  test('points at the web page of the offer, without a /jobs segment', ({ assert }) => {
    assert.equal(
      careersJobUrl('doztra', 'comptable-2'),
      `${authSettings.webAppUrl}/careers/doztra/comptable-2`
    )
  })
})
