import { test } from '@japa/runner'
import {
  haversineMeters,
  insidePolygon,
  maskUid,
  normalizeUid,
  polygonProblem,
  uidHash,
} from '#modules/timeclock/timeclock_rules'

test.group('normalizeUid (docs/backend/07 §2.2)', () => {
  test('equivalent writings of one badge give one canonical UID', ({ assert }) => {
    for (const raw of ['0c:9c:6b:3e', '0C9C6B3E', '0c-9c-6b-3e', '0c 9c 6b 3e', '0c.9c.6b.3e']) {
      assert.equal(normalizeUid(raw), '0C9C6B3E', raw)
    }
    // 07 §2.2 gave 210872894, which is 0x0C91AA3E: the example is corrected.
    assert.equal(normalizeUid('211577662'), '0C9C6B3E')
    assert.equal(normalizeUid('210872894'), '0C91AA3E')
  })

  test('drops leading zeros beyond 8 characters', ({ assert }) => {
    assert.equal(normalizeUid('000C9C6B3E'), '0C9C6B3E')
    assert.equal(normalizeUid('04A1B2C3D4E5F6'), '04A1B2C3D4E5F6')
  })

  test('digits with byte separators are hexadecimal, not an integer', ({ assert }) => {
    assert.equal(normalizeUid('04:12:34:56'), '04123456')
  })

  test('refuses what is not a UID', ({ assert }) => {
    assert.isNull(normalizeUid('ZZ:12'))
    assert.isNull(normalizeUid('  '))
    assert.isNull(normalizeUid('0A'))
  })

  test('hashes with the pepper and masks all but four characters', ({ assert }) => {
    assert.notEqual(uidHash('0C9C6B3E', 'a'), uidHash('0C9C6B3E', 'b'))
    assert.lengthOf(uidHash('0C9C6B3E', 'a'), 64)
    assert.equal(maskUid('0C9C6B3E'), '••••6B3E')
  })
})

test.group('zones (07 §2.1)', () => {
  const kaloum = { latitude: 9.5092, longitude: -13.7122 }

  test('haversine distance', ({ assert }) => {
    const north = { latitude: 9.5092 + 0.001, longitude: -13.7122 }
    assert.approximately(haversineMeters(kaloum, north), 111.2, 0.5)
    assert.equal(haversineMeters(kaloum, kaloum), 0)
  })

  test('ray casting on a square', ({ assert }) => {
    const ring = [
      [-13.713, 9.508],
      [-13.711, 9.508],
      [-13.711, 9.51],
      [-13.713, 9.51],
      [-13.713, 9.508],
    ]
    assert.isTrue(insidePolygon(kaloum, ring))
    assert.isFalse(insidePolygon({ latitude: 9.52, longitude: -13.712 }, ring))
    assert.isNull(polygonProblem(ring))
  })

  test('polygon validation', ({ assert }) => {
    assert.equal(
      polygonProblem([
        [0, 0],
        [1, 0],
        [0, 0],
      ]),
      'pointCount'
    )
    assert.equal(
      polygonProblem([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
      'notClosed'
    )
    assert.equal(
      polygonProblem([
        [0, 0],
        [1, 1],
        [1, 0],
        [0, 1],
        [0, 0],
      ]),
      'selfIntersecting'
    )
    assert.equal(
      polygonProblem([
        [0, 0],
        [200, 0],
        [1, 1],
        [0, 0],
      ]),
      'coordinates'
    )
  })
})
