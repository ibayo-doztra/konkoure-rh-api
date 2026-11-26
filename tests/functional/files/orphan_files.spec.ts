import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import type Organization from '#models/organization'
import StoredFile from '#models/stored_file'
import orphanFileService from '#shared/files/orphan_file_service'
import { newId } from '#shared/utils/crypto'
import { createEmployee, createHrOrganization } from '#tests/helpers/hr'

const OLD = () => DateTime.now().minus({ hours: 25 })

/** Registry row plus its object on the faked disk of its bucket. */
async function stored(
  organization: Organization,
  ownerType: string,
  ownerId: string | null,
  options: { createdAt?: DateTime; bucket?: 'private-docs' | 'public-assets' } = {}
) {
  const bucket = options.bucket ?? 'private-docs'
  const path = `${organization.id}/${ownerType}/${ownerId ?? 'none'}/${newId()}.pdf`
  await drive.use(bucket === 'private-docs' ? 's3' : 's3Public').put(path, 'x')
  return StoredFile.create({
    organizationId: organization.id,
    bucket,
    path,
    mime: 'application/pdf',
    sizeBytes: 1,
    checksumSha256: 'x'.repeat(64),
    ownerType,
    ownerId,
    visibility: bucket === 'private-docs' ? 'private' : 'public',
    createdAt: options.createdAt ?? OLD(),
  })
}

async function exists(file: StoredFile) {
  const disk = drive.use(file.bucket === 'private-docs' ? 's3' : 's3Public')
  return disk.exists(file.path)
}

test.group('files.purge-orphans', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake('s3')
    drive.fake('s3Public')
    return () => {
      drive.restore('s3')
      drive.restore('s3Public')
    }
  })

  test('deletes rows and objects whose owner is gone for more than 24 hours', async ({
    assert,
  }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const employee = await createEmployee(org)

    const orphans = [
      await stored(org, 'employee', newId()),
      await stored(org, 'leave_attachment', newId()),
      await stored(other, 'contract', newId()),
      await stored(org, 'organization_logo', newId(), { bucket: 'public-assets' }),
      await stored(org, 'candidate', null),
    ]
    const kept = [
      await stored(org, 'employee', employee.id),
      await stored(org, 'employee_photo', employee.id, { bucket: 'public-assets' }),
      await stored(org, 'organization_logo', org.id, { bucket: 'public-assets' }),
      // Less than 24 hours: an upload whose owner may still be on its way.
      await stored(org, 'leave_attachment', newId(), {
        createdAt: DateTime.now().minus({ hours: 2 }),
      }),
      // Unknown type: never touched.
      await stored(org, 'something_else', newId()),
    ]

    assert.equal(await orphanFileService.purge(), orphans.length)
    for (const file of orphans) {
      assert.isNull(await StoredFile.find(file.id), file.ownerType)
      assert.isFalse(await exists(file), file.ownerType)
    }
    for (const file of kept) {
      assert.exists(await StoredFile.find(file.id), file.ownerType)
      assert.isTrue(await exists(file), file.ownerType)
    }
    assert.equal(await orphanFileService.purge(), 0)
  })

  test('a soft-deleted owner still owns its files', async ({ assert }) => {
    const org = await createHrOrganization()
    const employee = await createEmployee(org)
    employee.merge({ deletedAt: DateTime.now().minus({ days: 3 }) })
    await employee.save()
    const file = await stored(org, 'employee', employee.id)

    assert.equal(await orphanFileService.purge(), 0)
    assert.exists(await StoredFile.find(file.id))
  })

  test('a row whose object cannot be deleted stays for the next run', async ({ assert }) => {
    const org = await createHrOrganization()
    const file = await stored(org, 'contract', newId())
    file.merge({ bucket: 'unknown-bucket' })
    await file.save()

    assert.equal(await orphanFileService.purge(), 0)
    assert.exists(await StoredFile.find(file.id))
  })
})
