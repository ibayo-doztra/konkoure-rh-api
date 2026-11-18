/*
|--------------------------------------------------------------------------
| Background jobs (docs/backend/08 §1)
|--------------------------------------------------------------------------
|
| With BullMQ, `mail.sendLater()` goes through the `default` queue and survives
| a restart. The `sync` driver keeps the in-memory messenger of @adonisjs/mail.
|
*/

import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import queueService, { queueDriver } from '#shared/queue/queue_service'

if (queueDriver === 'bullmq') {
  mail.setMessenger(() => ({
    queue: (message, sendConfig) =>
      queueService.dispatch('mail.send', { mail: message, sendConfig }),
  }))
}

app.terminating(() => queueService.close())
