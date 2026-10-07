// UI observes committed local projections only; no submit/accept state (implementation §6).
import { create } from 'zustand'
export const usePuzzleSync = create<{ pending: number; message: string | null; recoveryIds: string[] }>(() => ({ pending: 0, message: null, recoveryIds: [] }))
