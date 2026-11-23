import { test } from '@japa/runner'
import { isWeighted, statusForProgress } from '#modules/performance/goal_rules'

test.group('statusForProgress (07 §5.2)', () => {
  test('100 % achieves any open goal', ({ assert }) => {
    assert.equal(statusForProgress('not_started', 100), 'achieved')
    assert.equal(statusForProgress('in_progress', 100), 'achieved')
    assert.equal(statusForProgress('late', 100), 'achieved')
  })

  test('a first step starts the goal, a late one stays late', ({ assert }) => {
    assert.equal(statusForProgress('not_started', 0), 'not_started')
    assert.equal(statusForProgress('not_started', 10), 'in_progress')
    assert.equal(statusForProgress('late', 40), 'late')
  })

  test('falling under 100 % reopens an achieved goal', ({ assert }) => {
    assert.equal(statusForProgress('achieved', 90), 'in_progress')
  })

  test('a cancelled goal stays cancelled and leaves the weight budget', ({ assert }) => {
    assert.equal(statusForProgress('cancelled', 100), 'cancelled')
    assert.isFalse(isWeighted('cancelled'))
    assert.isTrue(isWeighted('achieved'))
  })
})
