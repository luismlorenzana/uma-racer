import type { SaveSnapshot, SyncRequest, SyncResponse } from './save.types'

// Persistence abstraction (same pattern as uma-planner's PlanRepository): swap local file vs Firestore
// without touching the controller.
export interface SaveRepository {
  load(uid: string): Promise<SaveSnapshot>
  sync(uid: string, request: SyncRequest): Promise<SyncResponse>
}

export const SAVE_REPOSITORY = Symbol('SAVE_REPOSITORY')
