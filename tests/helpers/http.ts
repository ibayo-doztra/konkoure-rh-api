import type { ApiResponse } from '@japa/api-client'

/** Awaits a request and asserts its status, returning the response. */
export async function expectStatus(request: PromiseLike<ApiResponse>, status: number) {
  const response = await request
  response.assertStatus(status)
  return response
}

/**
 * Sends a body outside the typed route contract (invalid payloads, or the
 * `password_confirmation` field that VineJS `confirmed()` drops from its type).
 */
export function untyped(body: Record<string, unknown>): never {
  return body as never
}

export interface ErrorBody {
  error: {
    code: string
    message: string
    requestId: string | null
    details: Array<{ field: string; rule: string; message: string }>
  }
}

/** Error envelope of a response, whatever the success type of its route. */
export function errorOf(response: { body(): unknown }): ErrorBody['error'] {
  return (response.body() as ErrorBody).error
}
