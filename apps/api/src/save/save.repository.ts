// Generation 3's persistence (docs/game/architecture.md "The save and sync"; D381; T152): one interface, a Firestore
// implementation at `g3/{uid}` and a local JSON one for dev, both on `resolve.ts`.
import type { OperationEnv, SaveSnapshot, SyncRequest, SyncResponse } from '@racer/domain/save'
import type { NoSave } from './resolve'

/** Loads the operation env (`OperationContent`); a repository calls it once, and only for a request with an operation. */
export type OperationEnvLoader = () => Promise<OperationEnv>

export interface SaveRepository {
  /** One page of the rows saved after `since`, resuming at `cursor` (one `resolve.ts` wrote). */
  snapshot(uid: string, since: number, cursor: string | null): Promise<SaveSnapshot>
  /** One sync, atomically: every change answered in order, or `NO_SAVE` with nothing written. */
  sync(uid: string, request: SyncRequest, env: OperationEnvLoader): Promise<SyncResponse | NoSave>
}

export const SAVE_REPOSITORY = Symbol('SAVE_REPOSITORY')
