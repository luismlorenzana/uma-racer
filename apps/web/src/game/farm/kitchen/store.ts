// Narrow reactive selectors over committed Dexie reads; clock/foreground events never write (technical §7).
import { liveQuery } from 'dexie'
import { createStore } from 'zustand/vanilla'
import type { RacerDb } from '../../db'
import type { FarmKitchenHost } from './host'
import { sameFarmSlice, type FarmKitchenReadInput, type FarmKitchenView } from './view'

export interface FarmKitchenStoreState {
  status: 'loading' | 'ready' | 'error'; controlsReady: boolean; error: string | null
  control: FarmKitchenView['control']; stations: FarmKitchenView['stations']; workers: FarmKitchenView['workers']
  recipes: FarmKitchenView['recipes']; items: FarmKitchenView['items']; extra: FarmKitchenView['extra']
  view: FarmKitchenView | null
}
export function createFarmKitchenStore() {
  return createStore<FarmKitchenStoreState>(() => ({ status: 'loading', controlsReady: false, error: null,
    control: null, stations: [], workers: {}, recipes: {}, items: {}, extra: null, view: null }))
}
export type FarmKitchenStore = ReturnType<typeof createFarmKitchenStore>
export function publishFarmKitchenView(store: FarmKitchenStore, view: FarmKitchenView): void {
  const previous = store.getState(), stable = <K extends 'control' | 'stations' | 'workers' | 'recipes' | 'items' | 'extra'>(key: K) =>
    sameFarmSlice(previous[key], view[key]) ? previous[key] : view[key]
  store.setState({ status: 'ready', controlsReady: view.mode === 'active', error: view.message, view,
    control: stable('control'), stations: stable('stations'), workers: stable('workers'), recipes: stable('recipes'), items: stable('items'), extra: stable('extra') })
}
export interface FarmObserverEvents {
  visible(): boolean; onFocus(listener: () => void): () => void; onVisibility(listener: () => void): () => void
  now(): number; setTimer(listener: () => void, ms: number): unknown; clearTimer(timer: unknown): void
}
const browserEvents: FarmObserverEvents = {
  visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden', now: Date.now,
  onFocus: listener => { window.addEventListener('focus', listener); return () => window.removeEventListener('focus', listener) },
  onVisibility: listener => { document.addEventListener('visibilitychange', listener); return () => document.removeEventListener('visibilitychange', listener) },
  setTimer: (listener, ms) => setTimeout(listener, ms), clearTimer: timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
}
/** One observer per mounted Farm provider; stop cancels clocks/subscriptions and late-read publications. */
export function observeFarmKitchen(host: FarmKitchenHost, _db: RacerDb, store: FarmKitchenStore,
  input: FarmKitchenReadInput = {}, events: FarmObserverEvents = browserEvents): () => void {
  let stopped = false, epoch = 0, refreshing: number | null = null, timer: unknown = null
  const clear = () => { if (timer !== null) events.clearTimer(timer); timer = null }
  const arm = () => {
    clear()
    if (!stopped && events.visible()) timer = events.setTimer(() => { void refresh() }, 60000 - events.now() % 60000)
  }
  const refresh = async () => {
    if (stopped || !events.visible()) return
    const token = ++epoch
    refreshing = token
    store.setState({ controlsReady: false })
    try {
      const view = await host.read(input)
      if (!stopped && token === epoch && events.visible()) publishFarmKitchenView(store, view)
    } catch (error) {
      if (!stopped && token === epoch) store.setState({ status: 'error', controlsReady: false, error: error instanceof Error ? error.message : 'Farm needs recovery' })
    } finally { if (!stopped && token === epoch) { refreshing = null; arm() } }
  }
  const subscription = liveQuery(() => host.read(input)).subscribe({ next: view => {
    // A previous live-query result must not re-enable controls before the foreground read completes.
    if (!stopped && refreshing === null && events.visible()) publishFarmKitchenView(store, view)
  }, error: error => { if (!stopped) store.setState({ status: 'error', controlsReady: false, error: String(error) }) } })
  const unFocus = events.onFocus(() => { void refresh() }), unVisibility = events.onVisibility(() => {
    epoch++; clear(); store.setState({ controlsReady: false })
    if (events.visible()) void refresh()
  })
  void refresh()
  return () => { stopped = true; epoch++; clear(); subscription.unsubscribe(); unFocus(); unVisibility(); store.setState({ controlsReady: false }) }
}
