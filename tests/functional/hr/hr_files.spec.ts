import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Employee from '#models/employee'
import LeaveRequest from '#models/leave_request'
import StoredFile from '#models/stored_file'
import { ContractExpiringMail } from '#modules/hr/mails/contract_expiring_mail'
import contractExpiryService from '#modules/hr/services/contract_expiry_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createContract,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'
import { balanceOf, displayed, week } from '#tests/helpers/leaves'

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1')
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
])

const fakeStorage = () => {
  drive.fake('s3')
  drive.fake('s3Public')
  return () => {
    drive.restore('s3')
    drive.restore('s3Public')
  }
}

const filesOf = (ownerType: string, ownerId: string) =>
  StoredFile.query().where('owner_type', ownerType).where('owner_id', ownerId)

test.group('Employee documents', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(fakeStorage)

  test('the employee and HR manage documents; links are audited', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    const id = employee.employee!.id
    const upload = (who: typeof hr, body: { category?: string; name?: string } = {}) =>
      orgCall(client, 'POST', `/employees/${id}/documents`, who, org)
        .file('file', PDF, { filename: '../Passeport scanné.pdf' })
        .fields({ category: 'passport', ...body })

    const created = await expectStatus(upload(employee), 201)
    const document = created.body().data
    assert.include(document, { category: 'passport', name: 'Passeport scanné' })
    assert.include(document, { mime: 'application/pdf' })
    assert.notProperty(document, 'path')
    await expectStatus(upload(hr, { category: 'diploma', name: 'Licence' }), 201)
    await expectStatus(upload(manager), 403)
    const invalid = await expectStatus(upload(employee, { category: 'tax' }), 422)
    assert.equal(errorOf(invalid).details[0].field, 'category')

    const listed = await expectStatus(
      orgCall(client, 'GET', `/employees/${id}/documents`, employee, org),
      200
    )
    assert.lengthOf(listed.body().data, 2)
    await expectStatus(orgCall(client, 'GET', `/employees/${id}/documents`, manager, org), 403)

    const link = await expectStatus(
      orgCall(client, 'GET', `/employees/${id}/documents/${document.id}/url`, hr, org),
      200
    )
    assert.equal(link.body().data.expiresIn, 900)
    const viewed = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'sensitive_document.viewed')
    assert.lengthOf(viewed, 1)

    const path = `/employees/${id}/documents/${document.id}`
    await expectStatus(orgCall(client, 'DELETE', path, employee, org), 403)
    await expectStatus(orgCall(client, 'DELETE', path, hr, org), 204)
    assert.lengthOf(await filesOf('employee', id), 1)
    await expectStatus(orgCall(client, 'GET', `${path}/url`, hr, org), 404)

    const foreign = await createEmployee(other)
    await expectStatus(orgCall(client, 'GET', `/employees/${foreign.id}/documents`, hr, org), 404)
  })

  test('refuses a file whose content is not a document', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const target = await createEmployee(org)
    const response = await expectStatus(
      orgCall(client, 'POST', `/employees/${target.id}/documents`, hr, org)
        .file('file', Buffer.from('MZ fake executable'), { filename: 'cv.pdf' })
        .fields({ category: 'other' }),
      422
    )
    assert.equal(errorOf(response).details[0].rule, 'documentType')
    assert.lengthOf(await filesOf('employee', target.id), 0)
  })
})

test.group('Employee photo', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(fakeStorage)

  test('the employee replaces their photo; only the last one is kept', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const peer = await hrSession(client, org, ['employee'])
    const id = employee.employee!.id
    const upload = (who: typeof peer, content = PNG) =>
      orgCall(client, 'POST', `/employees/${id}/photo`, who, org).file('file', content, {
        filename: 'moi.png',
      })

    const first = await expectStatus(upload(employee), 200)
    const firstUrl = first.body().data.photoUrl
    assert.isString(firstUrl)
    const second = await expectStatus(upload(employee), 200)
    assert.notEqual(second.body().data.photoUrl, firstUrl)
    assert.lengthOf(await filesOf('employee_photo', id), 1)

    await expectStatus(upload(peer), 403)
    await expectStatus(upload(employee, PDF), 422)
  })
})

test.group('Contract document upload', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(fakeStorage)

  test('HR uploads and replaces the document; the employee reads it', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])
    const contract = await createContract(employee.employee!)
    const upload = (who: typeof hr, contractId = contract.id) =>
      orgCall(client, 'POST', `/contracts/${contractId}/document`, who, org).file('file', PDF, {
        filename: 'contrat.pdf',
      })

    await expectStatus(upload(employee), 403)
    const uploaded = await expectStatus(upload(hr), 200)
    assert.isTrue(uploaded.body().data.hasDocument)
    await expectStatus(upload(hr), 200)
    assert.lengthOf(await filesOf('contract', contract.id), 1)
    await expectStatus(
      orgCall(client, 'GET', `/contracts/${contract.id}/document`, employee, org),
      200
    )
    const foreign = await createContract(await createEmployee(other))
    await expectStatus(upload(hr, foreign.id), 404)
  })
})

test.group('End of employment and team cache', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('termination cancels pending leaves and releases their days', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await hrSession(client, org, ['employee'])
    const created = await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'annual', ...week() }),
      201
    )

    await expectStatus(
      orgCall(client, 'PATCH', `/employees/${employee.employee!.id}`, owner, org).json({
        status: 'terminated',
      }),
      200
    )
    const leave = await LeaveRequest.findOrFail(created.body().data.id)
    assert.equal(leave.status, 'cancelled')
    assert.equal(displayed(await balanceOf(employee.employee!)), 30)
  })

  test('a change of manager is visible at once despite the cache', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const first = await hrSession(client, org, ['manager'])
    const second = await hrSession(client, org, ['manager'])
    const report = await createEmployee(org, { managerId: first.employee!.id })
    const teamOf = async (who: typeof first) => {
      const response = await expectStatus(
        orgCall(client, 'GET', `/employees/${who.employee!.id}/team`, who, org),
        200
      )
      return (response.body().data as Array<{ id: string }>).map((row) => row.id)
    }

    assert.deepEqual(await teamOf(first), [report.id])
    assert.deepEqual(await teamOf(second), [])
    await expectStatus(
      orgCall(client, 'PATCH', `/employees/${report.id}`, owner, org).json({
        managerId: second.employee!.id,
      }),
      200
    )
    assert.deepEqual(await teamOf(first), [])
    assert.deepEqual(await teamOf(second), [report.id])
  })
})

test.group('contracts:expiring', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('announces each contract ending within 30 days once, to hr_admin', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    await hrSession(client, org, ['owner'])
    const today = DateTime.now().setZone('Africa/Conakry').startOf('day')
    const soon = await createEmployee(org)
    await createContract(soon, { status: 'active', endDate: today.plus({ days: 12 }) })
    await createContract(await createEmployee(org), {
      status: 'active',
      endDate: today.plus({ days: 45 }),
    })
    await createContract(await createEmployee(org), {
      status: 'draft',
      endDate: today.plus({ days: 5 }),
    })

    assert.equal(await contractExpiryService.run(), 1)
    assert.equal(await contractExpiryService.run(), 0)
    mails.assertQueuedCount(ContractExpiringMail, 1)
    mails.assertQueued(ContractExpiringMail, (message) => message.message.hasTo(hr.user.email))
    const unchanged = await Employee.findOrFail(soon.id)
    assert.equal(unchanged.status, 'active')
  })
})
