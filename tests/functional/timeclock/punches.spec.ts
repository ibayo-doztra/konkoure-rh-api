import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import NfcBadgeEvent from '#models/nfc_badge_event'
import TimeLog from '#models/time_log'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import {
  FAR,
  NEAR,
  createPunch,
  createZone,
  giveBadge,
  setTimeclockSettings,
} from '#tests/helpers/timeclock'

type Session = Awaited<ReturnType<typeof hrSession>>

test.group('POST /org/timeclock/scan', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  async function setup(client: Parameters<typeof hrSession>[0]) {
    const org = await createHrOrganization()
    await setTimeclockSettings(org, { requireZone: false })
    const agent = await hrSession(client, org, ['security_agent'])
    const worker = await createEmployee(org, {
      firstName: 'Mariama',
      lastName: 'Diallo',
      jobTitle: 'Comptable',
    })
    await giveBadge(worker, '0C9C6B3E')
    const scan = (body: Record<string, unknown>, who: Session = agent) =>
      orgCall(client, 'POST', '/timeclock/scan', who, org).json(body)
    return { org, agent, worker, scan }
  }

  test('any writing of the UID finds the badge; in and out are deduced', async ({
    client,
    assert,
  }) => {
    const { worker, scan } = await setup(client)

    const first = await expectStatus(scan({ badgeUid: '0c:9c:6b:3e' }), 201)
    assert.deepInclude(first.body().data, {
      type: 'in',
      source: 'nfc',
      employee: {
        id: worker.id,
        fullName: 'Mariama Diallo',
        photoUrl: null,
        jobTitle: 'Comptable',
      },
    })
    const second = await expectStatus(scan({ badgeUid: '211577662' }), 201)
    assert.equal(second.body().data.type, 'out')
    const third = await expectStatus(scan({ badgeUid: '0C 9C 6B 3E' }), 409)
    assert.equal(errorOf(third).code, 'E_DUPLICATE_PUNCH')
  })

  test('unknown or foreign badges are refused alike and journaled', async ({ client, assert }) => {
    const { org, scan } = await setup(client)
    const other = await createHrOrganization('Autre')
    await giveBadge(await createEmployee(other), 'DEADBEEF')

    for (const badgeUid of ['DE:AD:BE:EF', '12345678', 'not-a-uid!']) {
      const response = await expectStatus(scan({ badgeUid }), 404)
      assert.equal(errorOf(response).code, 'E_BADGE_UNKNOWN')
    }
    const events = await NfcBadgeEvent.query()
      .where('organization_id', org.id)
      .where('event', 'scan_rejected')
    assert.lengthOf(events, 3)
    assert.equal(events[0].uidMasked, '••••BEEF')
    assert.notInclude(JSON.stringify(events.map((event) => event.serialize())), 'DEADBEEF')
  })

  test('only badge readers scan; a replayed clientPunchId returns the punch', async ({
    client,
    assert,
  }) => {
    const { org, scan } = await setup(client)
    const employee = await hrSession(client, org, ['employee'])
    await expectStatus(scan({ badgeUid: '0C9C6B3E' }, employee), 403)

    const clientPunchId = randomUUID()
    const created = await expectStatus(scan({ badgeUid: '0C9C6B3E', clientPunchId }), 201)
    const replayed = await expectStatus(scan({ badgeUid: '0C9C6B3E', clientPunchId }), 200)
    assert.equal(replayed.body().data.id, created.body().data.id)
  })

  test('zones: refusal, out of zone, low accuracy and clock drift', async ({ client, assert }) => {
    const { org, scan } = await setup(client)
    const zone = await createZone(org, { name: 'Siège Kaloum' })
    await setTimeclockSettings(org, { requireZone: true, maxAccuracyMeters: 50 })

    const outside = await expectStatus(scan({ badgeUid: '0C9C6B3E', ...FAR }), 422)
    assert.equal(errorOf(outside).code, 'E_OUT_OF_ZONE')
    const inside = await expectStatus(
      scan({
        badgeUid: '0C9C6B3E',
        ...NEAR,
        accuracyMeters: 10,
        punchedAt: DateTime.now().minus({ hours: 3 }).toISO(),
      }),
      201
    )
    assert.deepInclude(inside.body().data, {
      isWithinZone: true,
      workZone: { id: zone.id, name: 'Siège Kaloum' },
      anomaly: null,
    })
    assert.approximately(inside.body().data.distanceMeters, 55.6, 1)

    const blurry = await expectStatus(
      scan({
        badgeUid: '0C9C6B3E',
        ...FAR,
        accuracyMeters: 400,
        type: 'out',
        punchedAt: DateTime.now().minus({ hours: 2 }).toISO(),
      }),
      201
    )
    assert.include(blurry.body().data, { anomaly: 'low_accuracy', isWithinZone: false })

    await setTimeclockSettings(org, { requireZone: false })
    const away = await expectStatus(
      scan({
        badgeUid: '0C9C6B3E',
        ...FAR,
        type: 'in',
        punchedAt: DateTime.now().minus({ minutes: 30 }).toISO(),
      }),
      201
    )
    assert.include(away.body().data, { anomaly: 'out_of_zone', isWithinZone: false })

    const old = DateTime.now().minus({ days: 4 })
    const drifted = await expectStatus(
      scan({ badgeUid: '0C9C6B3E', type: 'out', punchedAt: old.toISO() }),
      201
    )
    assert.equal(drifted.body().data.anomaly, 'clock_drift')
    const recorded = DateTime.fromISO(drifted.body().data.punchedAt)
    assert.isBelow(Math.abs(recorded.diffNow('seconds').seconds), 10)
  })

  test('30 scans per minute per device', async ({ client, assert }) => {
    const { scan } = await setup(client)
    for (let index = 0; index < 30; index += 1) {
      const response = await scan({ badgeUid: 'FFFFFFFF', deviceId: 'lecteur-hall' })
      assert.equal(response.status(), 404)
    }
    await expectStatus(scan({ badgeUid: 'FFFFFFFF', deviceId: 'lecteur-hall' }), 429)
  })
})

test.group('POST /org/timeclock/punch and /sync', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('a punch for oneself must prove its zone and can be disabled', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    await createZone(org)
    const employee = await hrSession(client, org, ['employee'])
    const unlinked = await hrSession(client, org, ['manager'], { linked: false })
    const punch = (body: Record<string, unknown>, who: Session = employee) =>
      orgCall(client, 'POST', '/timeclock/punch', who, org).json(body)

    const gps = await expectStatus(punch({ ...NEAR, accuracyMeters: 12 }), 201)
    assert.include(gps.body().data, { source: 'mobile_gps', type: 'in', isWithinZone: true })
    await expectStatus(punch({}), 422)
    await expectStatus(punch(NEAR, unlinked), 403)

    await setTimeclockSettings(org, { allowManualPunch: false })
    const disabled = await expectStatus(punch(NEAR), 403)
    assert.equal(errorOf(disabled).code, 'E_MANUAL_PUNCH_DISABLED')
  })

  test('an offline batch reports each punch', async ({ client, assert }) => {
    const org = await createHrOrganization()
    await setTimeclockSettings(org, { requireZone: false })
    const employee = await hrSession(client, org, ['employee'])
    const known = randomUUID()
    const start = DateTime.now().minus({ hours: 5 })
    const punches = [
      { clientPunchId: known, punchedAt: start.toISO() },
      { clientPunchId: randomUUID(), punchedAt: start.plus({ hours: 4 }).toISO() },
      { clientPunchId: known, punchedAt: start.toISO() },
      { clientPunchId: randomUUID(), badgeUid: '0C9C6B3E' },
    ]
    const response = await expectStatus(
      orgCall(client, 'POST', '/timeclock/sync', employee, org).json({ punches }),
      200
    )
    assert.deepEqual(
      response
        .body()
        .data.map((row: { status: string; reason?: string }) => [row.status, row.reason]),
      [
        ['created', undefined],
        ['created', undefined],
        ['duplicate', undefined],
        ['rejected', 'E_FORBIDDEN'],
      ]
    )
    const logs = await TimeLog.query()
      .where('employee_id', employee.employee!.id)
      .orderBy('punched_at')
    assert.deepEqual(
      logs.map((log) => log.type),
      ['in', 'out']
    )
    await expectStatus(
      orgCall(client, 'POST', '/timeclock/sync', employee, org).json({ punches: [] }),
      422
    )
  })

  test('a kiosk syncs a batch of 200 scans', async ({ client, assert }) => {
    const org = await createHrOrganization()
    await setTimeclockSettings(org, { requireZone: false, duplicateWindowSeconds: 60 })
    const hr = await hrSession(client, org, ['hr_admin'])
    const worker = await createEmployee(org)
    await giveBadge(worker, '0C9C6B3E')
    const created = await expectStatus(
      orgCall(client, 'POST', '/timeclock/device-tokens', hr, org).json({ name: 'Hall' }),
      201
    )
    const start = DateTime.now().minus({ hours: 70 })
    const punches = Array.from({ length: 200 }, (_, index) => ({
      clientPunchId: randomUUID(),
      badgeUid: '0C9C6B3E',
      punchedAt: start.plus({ minutes: index * 15 }).toISO(),
    }))

    const begin = Date.now()
    const response = await expectStatus(
      client
        .post('/api/v1/org/timeclock/sync')
        .bearerToken(created.body().data.token)
        .json({ punches }),
      200
    )
    const elapsed = Date.now() - begin
    const statuses = new Set(response.body().data.map((row: { status: string }) => row.status))
    assert.deepEqual([...statuses], ['created'])
    const stored = await TimeLog.query().where('employee_id', worker.id)
    assert.lengthOf(stored, 200)
    assert.isBelow(elapsed, 20_000)
  })
})

test.group('GET/PATCH/DELETE /org/timeclock/logs', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists by role and hides other tenants', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const agent = await hrSession(client, org, ['security_agent'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const recruiter = await hrSession(client, org, ['recruiter'])
    const team = await createPunch(report.employee!)
    const own = await createPunch(manager.employee!)
    const unrelated = await createPunch(await createEmployee(org), { anomaly: 'out_of_zone' })
    await createPunch(await createEmployee(other))
    const ids = async (who: Session, query = '') => {
      const response = await expectStatus(
        orgCall(client, 'GET', `/timeclock/logs${query}`, who, org),
        200
      )
      return response.body().data.map((row: { id: string }) => row.id)
    }

    assert.sameMembers(await ids(owner), [team.id, own.id, unrelated.id])
    assert.sameMembers(await ids(agent), [team.id, own.id, unrelated.id])
    assert.sameMembers(await ids(manager), [team.id, own.id])
    assert.deepEqual(await ids(report), [team.id])
    assert.deepEqual(await ids(owner, '?filter[anomaly]=out_of_zone'), [unrelated.id])
    await expectStatus(orgCall(client, 'GET', '/timeclock/logs', recruiter, org), 403)
  })

  test('HR corrects and deletes punches, audited with the previous values', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const worker = await createEmployee(org)
    const punchedAt = DateTime.fromISO('2026-11-30T07:58:00Z')
    const log = await createPunch(worker, { punchedAt })
    const moved = DateTime.fromISO('2026-12-01T08:03:00Z')

    await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/logs/${log.id}`, manager, org).json({ notes: 'x' }),
      403
    )
    await expectStatus(orgCall(client, 'PATCH', `/timeclock/logs/${log.id}`, hr, org).json({}), 422)
    const corrected = await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/logs/${log.id}`, hr, org).json({
        punchedAt: moved.toISO(),
        notes: 'Badge oublié',
      }),
      200
    )
    assert.equal(DateTime.fromISO(corrected.body().data.punchedAt).toMillis(), moved.toMillis())
    const [audit] = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'time_log.corrected')
    assert.equal(
      DateTime.fromISO((audit.beforeData as { punchedAt: string }).punchedAt).toMillis(),
      punchedAt.toMillis()
    )

    const foreign = await createPunch(await createEmployee(other))
    await expectStatus(orgCall(client, 'DELETE', `/timeclock/logs/${foreign.id}`, hr, org), 404)
    await expectStatus(orgCall(client, 'DELETE', `/timeclock/logs/${log.id}`, hr, org), 204)
    assert.isNull(await TimeLog.find(log.id))
  })
})
