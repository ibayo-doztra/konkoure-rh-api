import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Candidate from '#models/candidate'
import CandidateEvent from '#models/candidate_event'
import type Organization from '#models/organization'
import { expectStatus } from '#tests/helpers/http'
import { createContract, createEmployee, hrSession, orgCall } from '#tests/helpers/hr'
import { createLeave } from '#tests/helpers/leaves'
import {
  createJob,
  createPublishedJob,
  createRecruitingOrganization,
} from '#tests/helpers/recruitment'

type Session = Awaited<ReturnType<typeof hrSession>>
type Client = Parameters<typeof hrSession>[0]

const ZONE = 'Africa/Conakry'

async function dashboard(client: Client, who: Session, org: Organization, query = '') {
  const response = await expectStatus(orgCall(client, 'GET', `/dashboard${query}`, who, org), 200)
  return response.body().data
}

async function candidate(
  org: Organization,
  jobId: string,
  createdAt: DateTime,
  hiredAt?: DateTime
) {
  const row = await Candidate.create({
    organizationId: org.id,
    jobId,
    fullName: 'Aïssatou Diallo',
    stage: hiredAt ? 'hired' : 'new',
  })
  await Candidate.query().where('id', row.id).update({ created_at: createdAt.toJSDate() })
  if (hiredAt) {
    await CandidateEvent.create({
      organizationId: org.id,
      candidateId: row.id,
      type: 'stage_changed',
      payload: { from: 'offer', to: 'hired' },
      createdAt: hiredAt,
    })
  }
  return row
}

test.group('GET /org/dashboard payroll, recruitment and previous period', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('payroll: contracts in force today, one per employee, for owner and hr_admin only', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization('Paie')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    const today = DateTime.now().setZone(ZONE).startOf('day')

    const a = await createEmployee(org)
    // Only one active contract per employee (database rule); a terminated one never counts today.
    await createContract(a, {
      status: 'terminated',
      salary: '3000000',
      startDate: today.minus({ years: 2 }),
    })
    await createContract(a, {
      status: 'active',
      salary: '4000000',
      startDate: today.minus({ months: 3 }),
    })
    const b = await createEmployee(org)
    await createContract(b, {
      status: 'active',
      salary: '2500000',
      startDate: today.minus({ years: 1 }),
    })
    // Not counted: a draft, an ended contract, another currency, a deleted employee, another org.
    await createContract(await createEmployee(org), { status: 'draft', salary: '9000000' })
    await createContract(await createEmployee(org), {
      status: 'active',
      salary: '9000000',
      startDate: today.minus({ years: 1 }),
      endDate: today.minus({ days: 1 }),
    })
    await createContract(await createEmployee(org), {
      status: 'active',
      salary: '900',
      currency: 'USD',
    })
    const gone = await createEmployee(org, { deletedAt: DateTime.now() })
    await createContract(gone, { status: 'active', salary: '9000000' })
    await createContract(await createEmployee(other), { status: 'active', salary: '9000000' })

    const expected = { total: 6_500_000, currency: 'GNF' }
    const [ofOwner, ofHr, ofManager, ofEmployee] = await Promise.all(
      [owner, hr, manager, employee].map((who) => dashboard(client, who, org))
    )
    assert.deepEqual(ofOwner.payroll, expected)
    assert.deepEqual(ofHr.payroll, expected)
    assert.isNull(ofManager.payroll)
    assert.isNull(ofEmployee.payroll)
    assert.isNull(ofManager.previous.payroll)
  })

  test('recruitment block for owner, hr_admin and recruiter; null for others', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization('Recrute')
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const member = await hrSession(client, org, ['employee'], { linked: false })
    const monthStart = DateTime.now().setZone(ZONE).startOf('month')
    const lastMonth = monthStart.minus({ months: 1 })

    const job = await createPublishedJob(org)
    await createPublishedJob(org)
    await createJob(org, { status: 'closed' })
    await candidate(org, job.id, monthStart.plus({ hours: 2 }))
    await candidate(org, job.id, monthStart.plus({ hours: 3 }), monthStart.plus({ hours: 5 }))
    await candidate(org, job.id, lastMonth.plus({ days: 2 }), lastMonth.plus({ days: 3 }))
    await candidate(org, job.id, lastMonth.plus({ days: 4 }))

    for (const who of [owner, recruiter]) {
      const data = await dashboard(client, who, org)
      assert.deepEqual(data.recruitment, { openJobs: 2, newCandidates: 2, hired: 1 })
      assert.deepEqual(data.previous.recruitment, { openJobs: null, newCandidates: 2, hired: 1 })
    }
    // Same `none` scope as the recruiter: the cache must not hand them its block.
    const plain = await dashboard(client, member, org)
    assert.isNull(plain.recruitment)
    assert.isNull(plain.previous.recruitment)
  })

  test('previous period: same blocks, present-moment indicators null', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization('Avant')
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const monthStart = DateTime.now().setZone(ZONE).startOf('month')
    const lastMonth = monthStart.minus({ months: 1 })
    const lastDay = monthStart.minus({ days: 1 })

    const veteran = await createEmployee(org, { hireDate: lastMonth.minus({ years: 1 }) })
    await createEmployee(org, { hireDate: lastMonth.plus({ days: 3 }) })
    await createEmployee(org, { hireDate: monthStart.plus({ days: 1 }) })
    // Left last month: counted as an exit, not in the staff at its end.
    await createEmployee(org, {
      status: 'terminated',
      hireDate: lastMonth.minus({ years: 1 }),
      endDate: lastMonth.plus({ days: 10 }),
    })
    await createLeave(veteran, {
      status: 'approved',
      startDate: lastMonth.plus({ days: 7 }),
      endDate: lastMonth.plus({ days: 8 }),
      requestedDays: '2.00',
      decidedAt: lastMonth.plus({ days: 2 }),
    })
    // Terminated since: it was in force on the last day of the previous month.
    await createContract(veteran, {
      status: 'terminated',
      salary: '5000000',
      startDate: lastMonth.minus({ years: 1 }),
      endDate: monthStart.plus({ days: 2 }),
    })

    const data = await dashboard(client, owner, org)
    const previous = data.previous
    assert.deepEqual(previous.period, { from: lastMonth.toISODate(), to: lastDay.toISODate() })
    assert.deepEqual(previous.headcount, {
      total: 2,
      active: null,
      onLeave: null,
      newHires: 1,
      exits: 1,
    })
    assert.deepEqual(previous.leaves, { pending: null, approvedThisPeriod: 1, daysTaken: 2 })
    assert.deepEqual(previous.attendance, {
      punctualityRate: null,
      avgWorkedHours: null,
      absencesToday: null,
      outOfZonePunches: 0,
    })
    assert.deepEqual(previous.performance, {
      reviewsInProgress: null,
      reviewsSigned: 0,
      avgGoalProgress: null,
    })
    assert.deepEqual(previous.payroll, { total: 5_000_000, currency: 'GNF' })
    assert.deepEqual(data.payroll, { total: 0, currency: 'GNF' })
    assert.notProperty(previous, 'series')

    const week = await dashboard(client, owner, org, '?period=week')
    const from = DateTime.fromISO(week.period.from)
    assert.equal(week.previous.period.from, from.minus({ weeks: 1 }).toISODate())
    assert.equal(week.previous.period.to, from.minus({ days: 1 }).toISODate())
  })
})
