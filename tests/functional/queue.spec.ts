import { test } from '@japa/runner'
import { backoffDelay, jobOptions, QueueService } from '#shared/queue/queue_service'
import type { SendMailPayload } from '#shared/queue/jobs'

const payload = { mail: { message: { subject: 'Test' }, views: {} } } as unknown as SendMailPayload

test.group('Background jobs (docs/backend/08 §1)', () => {
  test('backoff is exponential from 30 s and capped at one hour', ({ assert }) => {
    assert.equal(backoffDelay(1), 30_000)
    assert.equal(backoffDelay(2), 60_000)
    assert.equal(backoffDelay(3), 120_000)
    assert.equal(backoffDelay(20), 3_600_000)
  })

  test('mail jobs retry and leave no single-use link in Redis', ({ assert }) => {
    const options = jobOptions('mail.send')
    assert.equal(options.attempts, 5)
    assert.deepEqual(options.backoff, { type: 'custom' })
    assert.isTrue(options.removeOnComplete)
    assert.isTrue(options.removeOnFail)
  })

  test('BullMQ receives the job on its queue', async ({ assert, cleanup }) => {
    const service = new QueueService('bullmq')
    const queue = service.queue('default')
    cleanup(async () => {
      await queue.obliterate({ force: true })
      await service.close()
    })
    await queue.waitUntilReady()
    await queue.obliterate({ force: true })

    await service.dispatch('mail.send', payload)

    const [job] = await queue.getJobs(['waiting', 'prioritized'])
    assert.equal(job.name, 'mail.send')
    assert.equal(job.opts.attempts, 5)
  })
})
