// Pure sync-response checks (docs/tasks/T003-stable-save-foundation.md).

import type { EntityKind, SyncRequest, SyncResponse } from '@racer/domain'
import type { OutboxRow } from './db'

const key = (kind: EntityKind, id: string) => `${kind}/${id}`

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
  return batch.map((item) => item.seq).filter((sequence): sequence is number => sequence !== undefined)
}
