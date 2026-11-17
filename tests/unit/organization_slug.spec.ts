import { test } from '@japa/runner'
import { slugCandidate, slugify } from '#modules/organizations/slug'

test.group('organization slug', () => {
  test('strips accents, case and punctuation', ({ assert }) => {
    assert.equal(slugify('  Société Générale — Guinée !  '), 'societe-generale-guinee')
    assert.equal(slugify("L'Œuvre & Cie"), 'l-uvre-cie')
  })

  test('falls back when nothing usable remains', ({ assert }) => {
    assert.equal(slugify('— ! —'), 'organisation')
  })

  test('stays within 60 characters, suffix included', ({ assert }) => {
    const base = slugify('a'.repeat(59) + ' b')
    assert.isAtMost(base.length, 60)
    assert.notMatch(base, /-$/)
    const candidate = slugCandidate(base, 12)
    assert.isAtMost(candidate.length, 60)
    assert.match(candidate, /-12$/)
  })

  test('first candidate is the base itself', ({ assert }) => {
    assert.equal(slugCandidate('doztra', 1), 'doztra')
    assert.equal(slugCandidate('doztra', 2), 'doztra-2')
  })
})
