import type { SaveSnapshot, SyncRequest, SyncResponse } from './save.types'
import type { RpgCommandRequest, RpgCommandResponse } from './rpg-command'
import type { PuzzleTakeoverRequest, PuzzleTakeoverResponse } from './puzzles'

// Persistence abstraction (same pattern as uma-planner's PlanRepository): swap local file vs Firestore
// without touching the controller.
export interface SaveRepository {
  load(uid: string): Promise<SaveSnapshot>
  advanceInspiration(uid: string): Promise<SaveSnapshot>
  sync(uid: string, request: SyncRequest): Promise<SyncResponse>
  rpgCommand(uid: string, request: RpgCommandRequest): Promise<RpgCommandResponse>
  puzzleTakeover(uid: string, request: PuzzleTakeoverRequest): Promise<PuzzleTakeoverResponse>
}

export const SAVE_REPOSITORY = Symbol('SAVE_REPOSITORY')
