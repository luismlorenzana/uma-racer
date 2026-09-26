import type { BadgeStateV1, CardSave, FlairEventRecord, FlairEventV1, PlayerProfile, UmaSave } from '@racer/domain'
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
  badges: Readonly<Record<string, BadgeStateV1>>
  flairEvents: readonly (FlairEventV1 & { id: string })[]
  orphanedUmaIds: readonly string[]
  orphanedCardIds: readonly string[]
  sync: SyncState
  toasts: Toast[]
  pushToast: (text: string) => void
  dismissToast: (id: number) => void
}

/**
 * When this device last synced, kept across reloads so Settings and the top bar can tell a long silence from a fresh
 * start (D157). A per-device convenience: storage can be unavailable, and then it is simply unknown.
 */
const LAST_SYNC_KEY = 'uma-racer:last-sync'

export function rememberedLastSync(): number | null {
  try {
    const value = Number(globalThis.localStorage?.getItem(LAST_SYNC_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function rememberLastSync(at: number): void {
  try {
    globalThis.localStorage?.setItem(LAST_SYNC_KEY, String(at))
  } catch {
    // Private mode or blocked storage: the time stays in memory for this session.
  }
}

const emptySync = (): SyncState => ({ status: 'idle', pending: 0, lastSuccessAt: rememberedLastSync(), error: null })
let toastSeq = 0

export const useGame = create<GameState>()((set) => ({
  status: 'booting',
  error: null,
  persistent: true,
  profile: null,
  umas: {},
  cards: {},
  badges: {},
  flairEvents: [],
  orphanedUmaIds: [],
  orphanedCardIds: [],
  sync: emptySync(),
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
  badges?: Record<string, BadgeStateV1>
  flairEvents?: (FlairEventV1 & { id: string })[]
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
    badges: input.badges ?? {},
    flairEvents: input.flairEvents ?? [],
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

export function replaceCardState(profile: PlayerProfile, card: CardSave): void {
  useGame.setState((state) => ({
    profile,
    cards: { ...state.cards, [card.templateId]: card },
  }))
}

export function replaceUmaCollectionState(profile: PlayerProfile, uma: UmaSave): void {
  useGame.setState((state) => ({
    profile,
    umas: { ...state.umas, [uma.templateId]: uma },
  }))
}

export function replaceRaceState(profile: PlayerProfile, uma: UmaSave): void {
  useGame.setState((state) => ({
    profile,
    umas: { ...state.umas, [uma.templateId]: uma },
  }))
}

export function replaceBadgeState(badges: Record<string, BadgeStateV1>, flairEvents?: readonly (FlairEventV1 & { id: string })[]): void {
  useGame.setState({ badges, ...(flairEvents ? { flairEvents: [...flairEvents] } : {}) })
}

export function mergeBadgeAndFlairState(badges: Record<string, BadgeStateV1>, events: readonly FlairEventRecord[]): void {
  useGame.setState((state) => {
    const merged = new Map(state.flairEvents.map((event) => [event.id, event]))
    // The first copy of an award stands, as on disk (appendFlairEvents, D156).
    for (const event of events) if (!merged.has(event.id)) merged.set(event.id, { id: event.id, ...event.data })
    return {
      badges,
      flairEvents: [...merged.values()].sort((left, right) => left.earnedAt - right.earnedAt || left.id.localeCompare(right.id)),
    }
  })
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
    badges: {},
    flairEvents: [],
    orphanedUmaIds: [],
    orphanedCardIds: [],
    sync: emptySync(),
  })
}

export const localDay = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const selectProfile = (state: GameState) => state.profile
export const selectOwnedUmaCount = (state: GameState) => Object.keys(state.umas).length
export const selectOwnedCardCount = (state: GameState) => Object.keys(state.cards).length
export const selectUma = (id: string) => (state: GameState) => state.umas[id]
export const selectCard = (id: string) => (state: GameState) => state.cards[id]
export const selectBadgeState = (id: string) => (state: GameState) => state.badges[id]
export const selectSync = (state: GameState) => state.sync
