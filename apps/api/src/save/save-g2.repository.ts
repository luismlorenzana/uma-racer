// Generation 2's persistence (docs/rework/13-removals-and-plan-changes.md §6; docs/rearchitecture/07-data-reset.md §3; T135):
// one interface, a Firestore implementation at `saves/{uid}` and a local JSON one for dev, both on `resolve.ts`.
import type { OperationEnv, PurgeResponse, SaveSnapshotV2, SyncRequestV2, SyncResponseV2 } from '@racer/domain/save-g2'
import type { NoSave } from './resolve'

/** Loads the operation env (T135's `OperationContent`); a repository calls it once, and only for a request with an operation. */
export type OperationEnvLoader = () => Promise<OperationEnv>

export interface SaveG2Repository {
  /** One page of the rows saved after `since`, resuming at `cursor` (one `resolve.ts` wrote). */
  snapshot(uid: string, since: number, cursor: string | null): Promise<SaveSnapshotV2>
  /** One sync, atomically: every change answered in order, or `NO_SAVE` with nothing written. */
  sync(uid: string, request: SyncRequestV2, env: OperationEnvLoader): Promise<SyncResponseV2 | NoSave>
  /** Deletes the owner's generation-1 save once and records it at `saves/{uid}/meta/purge` (07 §3). */
  purge(uid: string): Promise<PurgeResponse>
}

export const SAVE_G2_REPOSITORY = Symbol('SAVE_G2_REPOSITORY')

/** The purge's record: `saves/{uid}/meta/purge`, or the local file's `purge`. */
export interface PurgeMarker {
  readonly generation: 2
  readonly at: number
  readonly collections: number
  readonly documents: number
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

/** A stored marker, checked. */
export function parsePurgeMarker(value: unknown): PurgeMarker {
  const marker = value as Partial<PurgeMarker> | null | undefined
  if (marker?.generation !== 2 || !isCount(marker.at) || !isCount(marker.collections) || !isCount(marker.documents)) {
    throw new Error('The purge marker is malformed')
  }
  return { generation: 2, at: marker.at, collections: marker.collections, documents: marker.documents }
}

/** The purge's answer from its marker. */
export const purgeResponse = (status: PurgeResponse['status'], marker: PurgeMarker): PurgeResponse => ({
  protocol: 2, generation: 2, status, at: marker.at, counts: { collections: marker.collections, documents: marker.documents },
})
