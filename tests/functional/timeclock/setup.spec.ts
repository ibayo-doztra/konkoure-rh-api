import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import NfcBadge from '#models/nfc_badge'
import NfcBadgeEvent from '#models/nfc_badge_event'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { KALOUM, createZone, giveBadge } from '#tests/helpers/timeclock'

const SQUARE = [
  [-13.713, 9.508],
  [-13.711, 9.508],
  [-13.711, 9.51],
  [-13.713, 9.51],
  [-13.713, 9.508],
]

test.group('Work zones', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('owner and hr_admin manage circles and polygons', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const post = (who: typeof hr, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/timeclock/zones', who, org).json(body)

    const circle = await expectStatus(
      post(hr, { name: 'Siège Kaloum', ...KALOUM, radiusMeters: 150 }),
      201
    )
    assert.include(circle.body().data, { shape: 'circle', radiusMeters: 150 })
    const polygon = await expectStatus(
      post(hr, { name: 'Entrepôt', shape: 'polygon', polygon: SQUARE }),
      201
    )
    assert.deepEqual(polygon.body().data.polygon, SQUARE)

    await expectStatus(post(manager, { name: 'Annexe', ...KALOUM, radiusMeters: 100 }), 403)
    const dup = await expectStatus(
      post(hr, { name: 'siège kaloum', ...KALOUM, radiusMeters: 100 }),
      409
    )
    assert.equal(errorOf(dup).details[0].field, 'name')
    const tiny = await expectStatus(post(hr, { name: 'Petit', ...KALOUM, radiusMeters: 5 }), 422)
    assert.equal(errorOf(tiny).details[0].field, 'radiusMeters')
    const crossed = await expectStatus(
      post(hr, {
        name: 'Noeud',
        shape: 'polygon',
        polygon: [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0],
        ],
      }),
      422
    )
    assert.equal(errorOf(crossed).details[0].rule, 'selfIntersecting')
    await expectStatus(post(hr, { name: 'Sans centre', radiusMeters: 100 }), 422)

    const listed = await expectStatus(orgCall(client, 'GET', '/timeclock/zones', manager, org), 200)
    assert.lengthOf(listed.body().data, 2)
    await expectStatus(orgCall(client, 'GET', '/timeclock/zones', employee, org), 403)

    const id = circle.body().data.id
    const updated = await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/zones/${id}`, hr, org).json({ radiusMeters: 300 }),
      200
    )
    assert.equal(updated.body().data.radiusMeters, 300)
    const foreign = await createZone(other)
    await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/zones/${foreign.id}`, hr, org).json({ name: 'Volée' }),
      404
    )
    await expectStatus(orgCall(client, 'DELETE', `/timeclock/zones/${id}`, hr, org), 204)
    const after = await expectStatus(orgCall(client, 'GET', '/timeclock/zones', hr, org), 200)
    assert.lengthOf(after.body().data, 1)
  })
})

test.group('Badges', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('assign, reassign and revoke with a masked UID only', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const agent = await hrSession(client, org, ['security_agent'])
    const employee = await createEmployee(org)
    const assign = (uid: string, who = agent, target = employee.id) =>
      orgCall(client, 'POST', `/employees/${target}/badge`, who, org).json({ badgeUid: uid })

    const first = await expectStatus(assign('0c:9c:6b:3e'), 201)
    assert.include(first.body().data, { uid: '••••6B3E', isActive: true })
    const shown = await expectStatus(
      orgCall(client, 'GET', `/employees/${employee.id}/badge`, agent, org),
      200
    )
    assert.equal(shown.body().data.uid, '••••6B3E')

    await expectStatus(assign('04:a1:b2:c3'), 201)
    const rows = await NfcBadge.query().where('employee_id', employee.id).orderBy('assigned_at')
    assert.lengthOf(rows, 2)
    assert.isNotNull(rows[0].revokedAt)
    const raw = JSON.stringify(rows.map((row) => row.serialize()))
    assert.notInclude(raw, '0C9C6B3E')

    const events = await NfcBadgeEvent.query()
      .where('organization_id', org.id)
      .orderBy('created_at')
    assert.deepEqual(
      events.map((event) => event.event),
      ['assigned', 'reassigned', 'assigned']
    )
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'badge.assigned')
    assert.notInclude(JSON.stringify(audit.map((row) => row.afterData)), '0C9C6B3E')

    await expectStatus(
      orgCall(client, 'DELETE', `/employees/${employee.id}/badge`, agent, org),
      204
    )
    const none = await expectStatus(
      orgCall(client, 'GET', `/employees/${employee.id}/badge`, agent, org),
      200
    )
    assert.isNull(none.body().data)
    await expectStatus(
      orgCall(client, 'DELETE', `/employees/${employee.id}/badge`, agent, org),
      404
    )
  })

  test('a badge is active in one place only; roles and tenants are checked', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const first = await createEmployee(org)
    const second = await createEmployee(org)
    const foreignEmployee = await createEmployee(other)
    await giveBadge(foreignEmployee, '11:22:33:44')
    const assign = (target: string, uid: string, who = owner) =>
      orgCall(client, 'POST', `/employees/${target}/badge`, who, org).json({ badgeUid: uid })

    await expectStatus(assign(first.id, 'AABBCCDD'), 201)
    const taken = await expectStatus(assign(second.id, 'aa:bb:cc:dd'), 409)
    assert.equal(errorOf(taken).details[0].rule, 'badgeTaken')
    const elsewhere = await expectStatus(assign(second.id, '11:22:33:44'), 409)
    assert.equal(errorOf(elsewhere).details[0].rule, 'badgeTaken')
    await expectStatus(assign(second.id, 'zz'), 422)
    await expectStatus(assign(second.id, '55667788', manager), 403)
    await expectStatus(assign(foreignEmployee.id, '55667788'), 404)
  })

  test('the end of employment revokes the badge', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const badge = await giveBadge(employee, '0A0B0C0D')
    await expectStatus(
      orgCall(client, 'PATCH', `/employees/${employee.id}`, owner, org).json({
        status: 'terminated',
      }),
      200
    )
    await badge.refresh()
    assert.isNotNull(badge.revokedAt)
    const [event] = await NfcBadgeEvent.query().where('badge_id', badge.id)
    assert.include(event.serialize(), { event: 'revoked', reason: 'employment_ended' })
  })
})

test.group('Kiosk tokens', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the token is shown once, opens scan only and can be revoked', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])
    const worker = await createEmployee(org, { firstName: 'Mariama', lastName: 'Diallo' })
    await giveBadge(worker, '0C9C6B3E')

    await expectStatus(
      orgCall(client, 'POST', '/timeclock/device-tokens', employee, org).json({ name: 'Hall' }),
      403
    )
    const created = await expectStatus(
      orgCall(client, 'POST', '/timeclock/device-tokens', hr, org).json({
        name: 'Hall',
        expiresInDays: 30,
      }),
      201
    )
    const { token, id } = created.body().data
    assert.match(token, /^kd_/)
    const listed = await expectStatus(
      orgCall(client, 'GET', '/timeclock/device-tokens', hr, org),
      200
    )
    assert.notProperty(listed.body().data[0], 'token')

    const kiosk = (path: string, body?: Record<string, unknown>) =>
      client
        .post(`/api/v1/org/timeclock${path}`)
        .bearerToken(token)
        .json(body ?? {})
    const scanned = await expectStatus(kiosk('/scan', { badgeUid: '0c:9c:6b:3e' }), 201)
    assert.include(scanned.body().data, { source: 'kiosk', type: 'in' })
    assert.equal(scanned.body().data.employee.fullName, 'Mariama Diallo')
    await expectStatus(
      client
        .get('/api/v1/org/timeclock/logs')
        .bearerToken(token)
        .header('X-Organization-Id', org.id),
      401
    )

    await expectStatus(orgCall(client, 'DELETE', `/timeclock/device-tokens/${id}`, hr, org), 204)
    await expectStatus(kiosk('/scan', { badgeUid: '0c:9c:6b:3e' }), 401)
    await expectStatus(
      client.post('/api/v1/org/timeclock/scan').bearerToken('kd_forged').json({ badgeUid: '1234' }),
      401
    )
  })
})
