// Pure sync-response checks (docs/technical/architecture.md).

import type { EntityKind, SyncRequest, SyncResponse } from '@racer/domain'
import type { OutboxRow } from './db'
import { parsePuzzleOperationResponses } from '@racer/domain'
import { parseFarmOperationResponses } from '@racer/domain/farm/kitchen'

const key = (kind: EntityKind, id: string) => `${kind}/${id}`
export type EconomicLane = 'ordinary' | 'puzzle' | 'farm'
/** Serialized round-robin: a continuously growing semantic queue cannot starve ordinary/Puzzle changes. */
export function nextEconomicLane(available: readonly EconomicLane[], previous: EconomicLane | null): EconomicLane | null {
  const order: EconomicLane[] = ['ordinary', 'puzzle', 'farm'], start = previous === null ? 0 : (order.indexOf(previous) + 1) % order.length
  for (let i = 0; i < order.length; i++) { const lane = order[(start + i) % order.length]!; if (available.includes(lane)) return lane }
  return null
}

/**
 * The server must account for every mutable entity exactly once. Append replies report only newly-created logs,
 * because an already-present log is also a successful idempotent acknowledgement.
 */
export function acknowledgedSequences(
  batch: readonly OutboxRow[],
  request: SyncRequest,
  response: SyncResponse,
): number[] {
  const requested = new Set(request.upserts.map((item) => key(item.kind, item.id)))
  const answered = [
    ...response.applied.map((item) => key(item.kind, item.id)),
    ...response.conflicts.map((item) => key(item.kind, item.id)),
  ]
  if (
    new Set(answered).size !== answered.length ||
    answered.length !== requested.size ||
    answered.some((item) => !requested.has(item))
  ) {
    throw new Error('Sync response does not account for the requested entities')
  }
  if (response.appended > request.appends.length) throw new Error('Sync response has an invalid append count')
  if (request.puzzleOperations && !parsePuzzleOperationResponses(response.puzzleOperations, request.puzzleOperations))
    throw new Error('Sync response does not account for the requested Puzzle operations')
  if (request.farmOperations && !parseFarmOperationResponses(response.farmOperations, request.farmOperations))
    throw new Error('Sync response does not account for the requested Farm operations')
  return batch.map((item) => item.seq).filter((sequence): sequence is number => sequence !== undefined)
}
