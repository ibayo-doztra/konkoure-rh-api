import { test } from '@japa/runner'
import {
  assertOutboundUrlShape,
  isBlockedAddress,
  OutboundUrlError,
  validateOutboundUrl,
} from '#shared/http/outbound'

const resolveTo =
  (...addresses: string[]) =>
  async () =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))

test.group('validateOutboundUrl (05 §10)', () => {
  test('accepts a public https host', async ({ assert }) => {
    const target = await validateOutboundUrl(
      'https://n8n.example.com/webhook/scoring?x=1',
      resolveTo('93.184.216.34')
    )
    assert.equal(target.address, '93.184.216.34')
  })

  test('refuses the shapes of rules 1 to 6', ({ assert }) => {
    for (const url of [
      'http://n8n.example.com/hook',
      'https://user:pass@n8n.example.com/hook',
      'https://n8n.example.com:8443/hook',
      'https://93.184.216.34/hook',
      'https://[::1]/hook',
      'https://localhost/hook',
      'https://n8n.internal/hook',
      'https://box.local/hook',
      'https://metadata.google.internal/x',
      'https://intranet/hook',
      'https://xn--n8n-9ka.example.com/hook',
      'pas une url',
    ]) {
      assert.throws(() => assertOutboundUrlShape(url), OutboundUrlError)
    }
  })

  test('refuses a name that resolves to a private or reserved address', async ({ assert }) => {
    for (const address of [
      '10.0.0.5',
      '127.0.0.1',
      '169.254.169.254',
      '172.20.1.1',
      '192.168.1.10',
      '100.64.0.1',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ]) {
      await assert.rejects(
        () =>
          validateOutboundUrl('https://n8n.example.com/hook', resolveTo('93.184.216.34', address)),
        OutboundUrlError
      )
      assert.isTrue(isBlockedAddress(address), address)
    }
    assert.isFalse(isBlockedAddress('2606:4700::1111'))
  })
})
