import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Employee from '#models/employee'
import StoredFile from '#models/stored_file'
import { EmployeesExportMail } from '#modules/hr/mails/employees_export_mail'
import employeeExportService from '#modules/hr/services/employee_export_service'
import queueService from '#shared/queue/queue_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createContract,
  createDepartment,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'

const HEADER = "Matricule;Nom;Prénom;E-mail;Département;Manager;Date d'embauche"
const BOM = String.fromCharCode(0xfeff)
const csv = (...lines: string[]) => Buffer.from(`${BOM}${[HEADER, ...lines].join('\r\n')}\r\n`)

type Session = Awaited<ReturnType<typeof hrSession>>

test.group('Employee import', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  async function setup(client: Parameters<typeof hrSession>[0]) {
    const org = await createHrOrganization('Mienne', 50)
    const hr = await hrSession(client, org, ['hr_admin'])
    const finance = await createDepartment(org, 'Finance')
    const existing = await createEmployee(org, {
      firstName: 'Mamadou',
      lastName: 'Diallo',
      employeeNumber: 'K-001',
      email: 'mamadou@doztra.com',
    })
    const unchanged = await createEmployee(org, {
      firstName: 'Fanta',
      lastName: 'Camara',
      employeeNumber: 'K-002',
    })
    const preview = (who: Session, content: Buffer, filename = 'employes.csv') =>
      orgCall(client, 'POST', '/employees/import/preview', who, org).file('file', content, {
        filename,
      })
    const commit = (who: Session, importToken: string) =>
      orgCall(client, 'POST', '/employees/import/commit', who, org).json({ importToken })
    return { org, hr, finance, existing, unchanged, preview, commit }
  }

  test('previews line by line, then commits all or nothing', async ({ client, assert }) => {
    const { org, hr, finance, existing, unchanged, preview, commit } = await setup(client)

    const faulty = await expectStatus(
      preview(
        hr,
        csv(
          'K-001;Diallo;Mamadou;mamadou@doztra.com;Finance;;2024-02-01',
          'K-002;Camara;Fanta;;;;',
          'K-003;Sow;Mariama;mariama@doztra.com;Finance;Mamadou Diallo;15/03/2025',
          'K-004;Bah;Ibrahima;pas-un-email;Logistique;;',
          'K-003;Barry;Oumou;;;Inconnu Personne;'
        )
      ),
      200
    )
    const body = faulty.body().data
    assert.deepEqual(body.summary, { total: 5, create: 1, update: 1, skip: 1, error: 2 })
    assert.deepEqual(
      body.errors.map((found: { line: number; rule: string }) => [found.line, found.rule]),
      [
        [5, 'email'],
        [5, 'unknownDepartment'],
        [6, 'duplicateInFile'],
        [6, 'unknownManager'],
      ]
    )
    assert.equal(body.errors[0].message, 'Adresse e-mail invalide.')

    const refused = await expectStatus(commit(hr, body.importToken), 422)
    assert.equal(errorOf(refused).details[0].field, 'line:5.email')
    assert.isNull(await Employee.findBy('employee_number', 'K-003'))

    const clean = await expectStatus(
      preview(
        hr,
        csv(
          'K-001;Diallo;Mamadou;mamadou@doztra.com;Finance;;2024-02-01',
          'K-002;Camara;Fanta;;;;',
          'K-003;Sow;Mariama;mariama@doztra.com;Finance;Mamadou Diallo;15/03/2025',
          'K-004;Bah;Ibrahima;;;Mariama Sow;'
        )
      ),
      200
    )
    const report = await expectStatus(commit(hr, clean.body().data.importToken), 200)
    assert.deepEqual(report.body().data, { created: 2, updated: 1, skipped: 1, errors: [] })

    const mariama = await Employee.findByOrFail('employee_number', 'K-003')
    const ibrahima = await Employee.findByOrFail('employee_number', 'K-004')
    assert.equal(mariama.managerId, existing.id)
    assert.equal(mariama.departmentId, finance.id)
    assert.equal(mariama.hireDate?.toISODate(), '2025-03-15')
    assert.equal(ibrahima.managerId, mariama.id)
    await existing.refresh()
    assert.equal(existing.departmentId, finance.id)
    assert.equal(existing.hireDate?.toISODate(), '2024-02-01')
    await unchanged.refresh()
    assert.isNull(unchanged.departmentId)
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'employee.imported')
    assert.lengthOf(audit, 1)

    const replayed = await expectStatus(commit(hr, clean.body().data.importToken), 422)
    assert.equal(errorOf(replayed).details[0].rule, 'expired')
  })

  test('reads an XLSX workbook with English headers', async ({ client, assert }) => {
    const { hr, preview, commit } = await setup(client)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Staff')
    sheet.addRow(['First name', 'Last name', 'Hire date', 'Ignored column'])
    sheet.addRow(['Kadiatou', 'Keita', new Date(Date.UTC(2025, 0, 6)), 'x'])
    const content = Buffer.from(await workbook.xlsx.writeBuffer())

    const previewed = await expectStatus(preview(hr, content, 'staff.xlsx'), 200)
    assert.deepInclude(previewed.body().data.summary, { create: 1, error: 0 })
    await expectStatus(commit(hr, previewed.body().data.importToken), 200)
    const created = await Employee.findByOrFail('last_name', 'Keita')
    assert.equal(created.hireDate?.toISODate(), '2025-01-06')
  })

  test('refuses other formats, missing columns, the quota and other roles', async ({
    client,
    assert,
  }) => {
    const { org, hr, preview, commit } = await setup(client)
    const binary = await expectStatus(preview(hr, Buffer.from([0x00, 0x01, 0x02])), 422)
    assert.equal(errorOf(binary).details[0].rule, 'format')
    const headless = await expectStatus(
      preview(hr, Buffer.from('Matricule;Poste\nK-9;Chef\n')),
      422
    )
    assert.equal(errorOf(headless).details[0].rule, 'missingColumn')

    const manager = await hrSession(client, org, ['manager'])
    await expectStatus(preview(manager, csv('K-9;Touré;Awa;;;;')), 403)

    const crowded = await createHrOrganization('Petite', 2)
    const owner = await hrSession(client, crowded, ['owner'])
    const quota = await expectStatus(
      orgCall(client, 'POST', '/employees/import/preview', owner, crowded).file(
        'file',
        csv('K-1;Touré;Awa;;;;', 'K-2;Kaba;Sékou;;;;'),
        { filename: 'equipe.csv' }
      ),
      200
    )
    assert.equal(quota.body().data.errors[0].rule, 'quotaExceeded')

    // A preview belongs to the user who made it.
    const valid = await expectStatus(preview(hr, csv('K-9;Touré;Awa;;;;')), 200)
    const other = await hrSession(client, org, ['owner'])
    await expectStatus(commit(other, valid.body().data.importToken), 422)
  })
})

test.group('Employee export', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('answers 202, is limited to 5 per hour and reserved to HR', async ({ client, assert }) => {
    const dispatched: unknown[] = []
    const original = queueService.dispatch.bind(queueService)
    queueService.dispatch = (async (_name: string, payload: unknown) => {
      dispatched.push(payload)
    }) as typeof queueService.dispatch
    try {
      const org = await createHrOrganization()
      const hr = await hrSession(client, org, ['hr_admin'])
      const employee = await hrSession(client, org, ['employee'])
      const request = (who: Session) =>
        orgCall(client, 'POST', '/employees/export', who, org).json({
          format: 'csv',
          filter: { status: 'active' },
        })

      await expectStatus(request(employee), 403)
      const accepted = await expectStatus(request(hr), 202)
      assert.isString(accepted.body().data.jobId)
      for (let index = 0; index < 4; index += 1) await expectStatus(request(hr), 202)
      await expectStatus(request(hr), 429)
      assert.lengthOf(dispatched, 5)
    } finally {
      queueService.dispatch = original
    }
  })

  test('the job writes a CSV without salary and e-mails a link', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const finance = await createDepartment(org, 'Finance')
    const boss = await createEmployee(org, { firstName: 'Mamadou', lastName: 'Diallo' })
    const worker = await createEmployee(org, {
      firstName: '=HYPERLINK("x")',
      lastName: 'Sow',
      departmentId: finance.id,
      managerId: boss.id,
      employeeNumber: 'K-7',
      baseSalary: '9000000',
    })
    await createContract(worker, { status: 'active', type: 'cdd' })

    const rows = await employeeExportService.build({
      exportId: 'test',
      organizationId: org.id,
      userId: hr.user.id,
      format: 'csv',
      filters: {},
    })
    assert.equal(rows, 3)
    mails.assertQueued(EmployeesExportMail, (message) => message.message.hasTo(hr.user.email))

    const file = await StoredFile.query()
      .where('owner_type', 'employee_export')
      .where('owner_id', hr.user.id)
      .firstOrFail()
    const text = Buffer.from(await drive.use('s3').getBytes(file.path)).toString('utf8')
    assert.isTrue(text.startsWith(`${BOM}Matricule;Nom;Prénom`))
    assert.include(text, `K-7;Sow;"'=HYPERLINK(""x"")";;;;Finance;Mamadou Diallo`)
    assert.include(text, ';cdd')
    assert.notInclude(text, '9000000')
  })
})
