// Generation 2's persistence (docs/rework/13-removals-and-plan-changes.md §6; docs/rearchitecture/07-data-reset.md §3; T135):
// one interface, a Firestore implementation at `saves/{uid}` and a local JSON one for dev, both on `resolve.ts`.
import type { OperationEnv, SaveSnapshotV2, SyncRequestV2, SyncResponseV2 } from '@racer/domain/save'
import type { NoSave } from './resolve'

/** Loads the operation env (T135's `OperationContent`); a repository calls it once, and only for a request with an operation. */
export type OperationEnvLoader = () => Promise<OperationEnv>

export interface SaveRepository {
  /** One page of the rows saved after `since`, resuming at `cursor` (one `resolve.ts` wrote). */
  snapshot(uid: string, since: number, cursor: string | null): Promise<SaveSnapshotV2>
  /** One sync, atomically: every change answered in order, or `NO_SAVE` with nothing written. */
  sync(uid: string, request: SyncRequestV2, env: OperationEnvLoader): Promise<SyncResponseV2 | NoSave>
}

export const SAVE_REPOSITORY = Symbol('SAVE_REPOSITORY')
