import { test } from '@japa/runner'
import { normalizeN8nResponse } from '#modules/recruitment/scoring/n8n_response'

test.group('normalizeN8nResponse (07 §4.4, 08 §5)', () => {
  test('reads the current format from a single-element array', ({ assert }) => {
    const result = normalizeN8nResponse([
      {
        candidate_name: 'Mariama Sow',
        is_valid_cv: true,
        match_score: 78.6,
        strengths: ['Comptabilité OHADA', '  ', 42],
        weaknesses_or_missing: ['Anglais'],
        summary_opinion: 'Profil solide.',
        fraud_alert: false,
        cv_url: 'https://n8n.example.com/cv.pdf',
      },
    ])
    assert.deepEqual(result, {
      aiScore: 79,
      aiJustification: 'Profil solide.',
      aiStrengths: ['Comptabilité OHADA'],
      aiWeaknesses: ['Anglais'],
      aiCandidateName: 'Mariama Sow',
      aiIsValidCv: true,
      aiFraudAlert: false,
    })
  })

  test('reads the legacy format from an object', ({ assert }) => {
    const result = normalizeN8nResponse({
      score: '55',
      justification: 'Correct.',
      weaknesses: ['Pas de diplôme'],
    })
    assert.equal(result?.aiScore, 55)
    assert.equal(result?.aiJustification, 'Correct.')
    assert.deepEqual(result?.aiWeaknesses, ['Pas de diplôme'])
    assert.isNull(result?.aiIsValidCv)
    assert.isNull(result?.aiFraudAlert)
  })

  test('keeps invalid CV and fraud signals as given, advisory only', ({ assert }) => {
    const result = normalizeN8nResponse({ match_score: 10, is_valid_cv: false, fraud_alert: true })
    assert.isFalse(result?.aiIsValidCv)
    assert.isTrue(result?.aiFraudAlert)
  })

  test('rejects anything without a usable score', ({ assert }) => {
    for (const payload of [
      null,
      'texte',
      [],
      [{ match_score: 50 }, { match_score: 60 }],
      { match_score: 140 },
      { match_score: -1 },
      { match_score: 'beaucoup' },
      { summary_opinion: 'sans score' },
    ]) {
      assert.isNull(normalizeN8nResponse(payload))
    }
  })

  test('caps lists and texts', ({ assert }) => {
    const result = normalizeN8nResponse({
      match_score: 50,
      strengths: Array.from({ length: 20 }, (_, i) => `force ${i}`),
      summary_opinion: 'x'.repeat(10_000),
    })
    assert.lengthOf(result!.aiStrengths, 10)
    assert.lengthOf(result!.aiJustification!, 4000)
  })
})
