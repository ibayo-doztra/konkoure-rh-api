import OpenAI from 'openai'
import logger from '@adonisjs/core/services/logger'
import { aiCalls, aiCredits } from '#shared/metrics/metrics'
import { AppException } from '#shared/exceptions/app_exception'
import env from '#start/env'
import aiCreditService from '#modules/billing/services/ai_credit_service'

/** 08 §7: a call never waits longer. */
const TIMEOUT_MS = 45_000
/** A non-conforming answer is retried once, then given up without side effect (08 §7). */
const ATTEMPTS = 2

/**
 * One versioned AI task (`app/modules/integrations/prompts/`): the prompt,
 * the JSON schema the model must follow, and the validation of its answer.
 */
export interface AiTask<Output> {
  name: string
  version: string
  system: string
  user: string
  /** JSON schema of the answer (OpenAI structured outputs, strict mode). */
  schema: Record<string, unknown>
  /** VineJS validation of the parsed answer; throws when it does not conform. */
  parse(value: unknown): Promise<Output>
}

export interface AiCompletionRequest {
  model: string
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
}

export type AiCompleter = (request: AiCompletionRequest) => Promise<string>

export interface AiUsage {
  organizationId: string
  userId: string | null
  /** Module charged in `usage_events` (`performance`, `recruitment`…). */
  module: string
  path: string | null
}

/**
 * Single AI gateway (docs/backend/08 §7, OpenAI decided on 2026-11-24): one
 * credit reserved per call and refunded on failure, strictly validated JSON,
 * 45 s timeout, one retry. No sensitive data is ever put in a prompt by the
 * callers (salary, ID documents, badge UID). `completer` is replaced by a fake
 * in tests: no network call there.
 */
export class AiService {
  completer: AiCompleter = (request) => this.openai(request)
  private client: OpenAI | null = null

  get configured() {
    return Boolean(env.get('AI_API_KEY') && env.get('AI_MODEL'))
  }

  async run<Output>(task: AiTask<Output>, usage: AiUsage): Promise<Output> {
    if (!this.configured) throw new AppException('E_AI_UNAVAILABLE')
    const reservation = await aiCreditService.reserve(usage.organizationId)
    const request = {
      model: env.get('AI_MODEL')!,
      system: task.system,
      user: task.user,
      schemaName: task.name.replace(/\W/g, '_'),
      schema: task.schema,
    }
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const output = await task.parse(JSON.parse(await this.completer(request)))
        await aiCreditService.record({
          ...usage,
          kind: 'ai',
          metadata: { task: task.name, version: task.version, cost: 1, attempts: attempt },
        })
        aiCalls.inc({ task: task.name, outcome: 'success' })
        aiCredits.inc()
        return output
      } catch (error) {
        logger.warn({ err: error, task: task.name, attempt }, 'ai.call_failed')
      }
    }
    aiCalls.inc({ task: task.name, outcome: 'failure' })
    await aiCreditService.refund(reservation)
    throw new AppException('E_AI_UNAVAILABLE')
  }

  private async openai(request: AiCompletionRequest) {
    this.client ??= new OpenAI({
      apiKey: env.get('AI_API_KEY')!.release(),
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    })
    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: request.schemaName, schema: request.schema, strict: true },
      },
    })
    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('empty AI answer')
    return content
  }
}

export default new AiService()
