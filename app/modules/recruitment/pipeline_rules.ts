import type { CandidateStage } from '#models/candidate'

/** Forward order of the pipeline (07 §4.5); `rejected` is reachable from any state. */
const ORDER: CandidateStage[] = ['new', 'screening', 'interview', 'offer']

export type StageCheck =
  | { ok: true; backward: boolean }
  | { ok: false; reason: 'hiredTerminal' | 'hireEndpoint' | 'sameStage' }

/**
 * Whether `from → to` is a pipeline move of `POST /stage` (07 §4.5, decision
 * of 2026-11-23): `hired` is terminal and only reached through `/hire`;
 * moving back, or out of `rejected`, is a backward move reserved to O H.
 */
export function checkStageMove(from: CandidateStage, to: CandidateStage): StageCheck {
  if (from === 'hired') return { ok: false, reason: 'hiredTerminal' }
  if (to === 'hired') return { ok: false, reason: 'hireEndpoint' }
  if (from === to) return { ok: false, reason: 'sameStage' }
  if (to === 'rejected') return { ok: true, backward: false }
  if (from === 'rejected') return { ok: true, backward: true }
  return { ok: true, backward: ORDER.indexOf(to) < ORDER.indexOf(from) }
}

/** First word as first name, the rest as last name ("Mamadou Alpha Diallo"). */
export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts[0] ?? fullName
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName
  return { firstName, lastName }
}
