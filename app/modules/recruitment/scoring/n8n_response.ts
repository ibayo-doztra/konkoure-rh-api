/** Columns written from an n8n scoring result (07 §4.4). */
export interface ScoringResult {
  aiScore: number
  aiJustification: string | null
  aiStrengths: string[]
  aiWeaknesses: string[]
  aiCandidateName: string | null
  aiIsValidCv: boolean | null
  aiFraudAlert: boolean | null
}

const MAX_ITEMS = 10
const MAX_ITEM_LENGTH = 500
const MAX_TEXT_LENGTH = 4000
const MAX_NAME_LENGTH = 200

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

const flag = (value: unknown) => (typeof value === 'boolean' ? value : null)

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .slice(0, MAX_ITEMS)
    .map((item) => item.trim().slice(0, MAX_ITEM_LENGTH))
}

function score(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) return null
  if (number < 0 || number > 100) return null
  return Math.round(number)
}

/**
 * `n8nResponseSchema` (docs/backend/08 §5): a single-element array or an
 * object, in the current format (`match_score`, `summary_opinion`,
 * `weaknesses_or_missing`, `candidate_name`, `is_valid_cv`, `fraud_alert`) or
 * the legacy one (`score`, `justification`, `weaknesses`). Score bounded to
 * 0–100, lists and texts capped. Anything without a usable score is `null`:
 * the stored values are then kept. A received `cv_url` is ignored.
 */
export function normalizeN8nResponse(payload: unknown): ScoringResult | null {
  let body = payload
  if (Array.isArray(body)) {
    if (body.length !== 1) return null
    body = body[0]
  }
  if (!isRecord(body)) return null
  const aiScore = score(body.match_score ?? body.score)
  if (aiScore === null) return null
  return {
    aiScore,
    aiJustification: text(body.summary_opinion ?? body.justification, MAX_TEXT_LENGTH),
    aiStrengths: list(body.strengths),
    aiWeaknesses: list(body.weaknesses_or_missing ?? body.weaknesses),
    aiCandidateName: text(body.candidate_name, MAX_NAME_LENGTH),
    aiIsValidCv: flag(body.is_valid_cv),
    aiFraudAlert: flag(body.fraud_alert),
  }
}
