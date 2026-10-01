import type { SaveSnapshot, SyncRequest, SyncResponse } from './save.types'
import type { RpgCommandRequest, RpgCommandResponse } from './rpg-command'

// Persistence abstraction (same pattern as uma-planner's PlanRepository): swap local file vs Firestore
// without touching the controller.
export interface SaveRepository {
  load(uid: string): Promise<SaveSnapshot>
  sync(uid: string, request: SyncRequest): Promise<SyncResponse>
  rpgCommand(uid: string, request: RpgCommandRequest): Promise<RpgCommandResponse>
}

export const SAVE_REPOSITORY = Symbol('SAVE_REPOSITORY')
