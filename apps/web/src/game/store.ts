import { grantDailyTickets } from '@racer/domain'
import { create } from 'zustand'
import { db, type OutboxRow, type ProfileRow } from './db'

export interface Toast {
  id: number
  text: string
}

interface GameState {
  ready: boolean
  /** False when IndexedDB is unavailable (e.g. private browsing) — the game still runs in memory. */
  persistent: boolean
  profile: ProfileRow
  toasts: Toast[]
  pushToast: (text: string) => void
  dismissToast: (id: number) => void
}

const DEFAULT_PROFILE: ProfileRow = {
  id: 'main',
  tickets: 0,
  cardCoupons: 3,
  umaCoupons: 0,
  umaShards: 0,
  lastDailyGrant: null,
  version: 0,
}

let toastSeq = 0

// Game state lives in Zustand with fine-grained selectors, so a counter tick only re-renders its own component.
export const useGame = create<GameState>()((set) => ({
  ready: false,
  persistent: true,
  profile: DEFAULT_PROFILE,
  toasts: [],
  pushToast: (text) => set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const localDay = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000)

async function queue(kind: OutboxRow['kind'], id: string, op: OutboxRow['op']) {
  await db.outbox.add({ kind, id, op, queuedAt: Date.now() })
}

/** Hydrates the store from IndexedDB and applies any daily ticket grants owed since the last visit. */
export async function bootGame(): Promise<void> {
  let profile = DEFAULT_PROFILE
  let persistent = true
  try {
    profile = (await db.profile.get('main')) ?? DEFAULT_PROFILE
  } catch {
    persistent = false
  }

  const today = localDay()
  const owedDays = profile.lastDailyGrant ? daysBetween(profile.lastDailyGrant, today) : 1
  if (owedDays > 0) {
    const tickets = grantDailyTickets(profile.tickets, owedDays)
    const granted = tickets - profile.tickets
    profile = { ...profile, tickets, lastDailyGrant: today }
    if (persistent) {
      await db.profile.put(profile)
      await queue('profile', 'main', 'upsert')
    }
    if (granted > 0) useGame.getState().pushToast(`+${granted} 🎫 Daily tickets`)
  }

  useGame.setState({ profile, persistent, ready: true })
}
