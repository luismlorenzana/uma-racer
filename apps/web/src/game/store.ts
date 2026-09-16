import type { CardSave, PlayerProfile, UmaSave } from '@racer/domain'
import { create } from 'zustand'

export type GameStatus = 'booting' | 'signed-out' | 'waiting-content' | 'ready' | 'error'
export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  lastSuccessAt: number | null
  error: string | null
}

export interface Toast {
  id: number
  text: string
}

interface GameState {
  status: GameStatus
  error: string | null
  persistent: boolean
  profile: PlayerProfile | null
  umas: Readonly<Record<string, UmaSave>>
  cards: Readonly<Record<string, CardSave>>
  orphanedUmaIds: readonly string[]
  orphanedCardIds: readonly string[]
  sync: SyncState
  toasts: Toast[]
  pushToast: (text: string) => void
  dismissToast: (id: number) => void
}

const EMPTY_SYNC: SyncState = { status: 'idle', pending: 0, lastSuccessAt: null, error: null }
let toastSeq = 0

export const useGame = create<GameState>()((set) => ({
  status: 'booting',
  error: null,
  persistent: true,
  profile: null,
  umas: {},
  cards: {},
  orphanedUmaIds: [],
  orphanedCardIds: [],
  sync: EMPTY_SYNC,
  toasts: [],
  pushToast: (text) => set((state) => ({ toasts: [...state.toasts, { id: ++toastSeq, text }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

export function setGameLifecycle(status: GameStatus, error: string | null = null): void {
  useGame.setState({ status, error })
}

export function adoptGameState(input: {
  profile: PlayerProfile
  umas: Record<string, UmaSave>
  cards: Record<string, CardSave>
  persistent: boolean
  orphanedUmaIds?: string[]
  orphanedCardIds?: string[]
}): void {
  useGame.setState({
    status: 'ready',
    error: null,
    profile: input.profile,
    umas: input.umas,
    cards: input.cards,
    persistent: input.persistent,
    orphanedUmaIds: input.orphanedUmaIds ?? [],
    orphanedCardIds: input.orphanedCardIds ?? [],
  })
}

export function replaceProfile(profile: PlayerProfile): void {
  useGame.setState({ profile })
}

export function replaceUma(uma: UmaSave): void {
  useGame.setState((state) => ({ umas: { ...state.umas, [uma.templateId]: uma } }))
}

export function replaceTrainingState(profile: PlayerProfile, uma: UmaSave, cards: readonly CardSave[]): void {
  useGame.setState((state) => ({
    profile,
    umas: { ...state.umas, [uma.templateId]: uma },
    cards: cards.reduce<Record<string, CardSave>>(
      (next, card) => ({ ...next, [card.templateId]: card }),
      state.cards as Record<string, CardSave>,
    ),
  }))
}

export function replaceRaceState(profile: PlayerProfile, uma: UmaSave): void {
  useGame.setState((state) => ({
    profile,
    umas: { ...state.umas, [uma.templateId]: uma },
  }))
}

export function setSyncState(sync: Partial<SyncState>): void {
  useGame.setState((state) => ({ sync: { ...state.sync, ...sync } }))
}

export function clearGameState(status: GameStatus = 'signed-out'): void {
  useGame.setState({
    status,
    error: null,
    profile: null,
    umas: {},
    cards: {},
    orphanedUmaIds: [],
    orphanedCardIds: [],
    sync: EMPTY_SYNC,
  })
}

export const localDay = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const selectProfile = (state: GameState) => state.profile
export const selectOwnedUmaCount = (state: GameState) => Object.keys(state.umas).length
export const selectOwnedCardCount = (state: GameState) => Object.keys(state.cards).length
export const selectUma = (id: string) => (state: GameState) => state.umas[id]
export const selectCard = (id: string) => (state: GameState) => state.cards[id]
export const selectSync = (state: GameState) => state.sync
