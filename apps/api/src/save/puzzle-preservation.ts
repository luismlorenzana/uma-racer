// Common boundary shared by JSON-file and Firestore preparation; never accepts a client-owned cohort.
import { parseEntityData, type EntityRecord, type LogRecord } from './save.types'
import { resolvePuzzlePreservation, preservationHeader, type PuzzlePreservationRequest, type VerifiedPuzzlePreservationContent,
  type PuzzlePreservationResponse } from './puzzles'

export const unavailablePreservation = (message: string): PuzzlePreservationResponse => ({ status: 'recoverable-error', message,
  summary: null, entities: [], logs: [] })
export const disabledPreservation = (): PuzzlePreservationResponse => ({ status: 'disabled', message: null, summary: null, entities: [], logs: [] })
export function resolvePreservation(entities: Map<string, EntityRecord>, logs: Map<string, LogRecord>, content: VerifiedPuzzlePreservationContent,
  request: PuzzlePreservationRequest, now: number) {
  if (!preservationHeader(entities)) for (const row of entities.values()) if ((row.kind === 'umas' || row.kind === 'profile' ||
    row.kind === 'items' && row.id === 'training:level-up-ticket') && !row.deleted && !parseEntityData(row.kind, row.data))
    throw new Error('Keep the save: authoritative legacy data needs migration or recovery before preparation')
  const result = resolvePuzzlePreservation({ enabled: true, now, entities, logs, content }, request)
  return { writes: result.writes as EntityRecord[], appends: result.appends as LogRecord[], response: result.response }
}
