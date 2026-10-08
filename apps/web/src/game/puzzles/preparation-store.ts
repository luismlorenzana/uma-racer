// Cheap observable startup status; no content, journal or economic I/O until the release capability is enabled.
import { create } from 'zustand'
import type { PuzzlePreservationSummary } from '@racer/domain'
import { PUZZLES_RELEASE_ENABLED } from './capability'
export interface PuzzlePreparationState {
  phase: 'unavailable' | 'needs-sync' | 'preparing' | 'active' | 'recoverable-error'; busy: boolean;
  message: string | null; summary: PuzzlePreservationSummary | null; preview: boolean
}
export const usePuzzlePreparation = create<PuzzlePreparationState>(() => ({ phase: 'unavailable', busy: false, message: null, summary: null, preview: false }))
/** An uncertain reply may already have frozen the server. Keep legacy economics locked until Retry reconciles it. */
export function locksLegacyTraining(state = usePuzzlePreparation.getState(), enabled = PUZZLES_RELEASE_ENABLED): boolean {
  return state.busy || enabled && ['preparing', 'active', 'recoverable-error'].includes(state.phase)
}
