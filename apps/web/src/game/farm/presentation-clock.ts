// One visibility-aware presentation clock for every Farm view (docs/design/farm.md#screen-contract, T084).

import { useSyncExternalStore } from 'react'

interface ClockEnvironment {
  now: () => number
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>
  clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => void
  hidden: () => boolean
  listen: (type: 'focus' | 'visibilitychange', listener: () => void) => () => void
}

export interface FarmPresentationClock {
  getSnapshot: () => number
  subscribe: (listener: () => void) => () => void
  activeTimerCount: () => number
  refresh: () => void
}

const nextMinuteDelay = (now: number): number => 60_000 - (now % 60_000)

export function createFarmPresentationClock(environment: ClockEnvironment): FarmPresentationClock {
  let value = environment.now()
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null
  const listeners = new Set<() => void>()
  let removeEvents: (() => void)[] = []

  const emit = () => {
    value = environment.now()
    for (const listener of listeners) listener()
  }
  const stopTimer = () => {
    if (timer !== null) environment.clearTimeout(timer)
    timer = null
  }
  const schedule = () => {
    stopTimer()
    if (listeners.size === 0 || environment.hidden()) return
    timer = environment.setTimeout(() => {
      timer = null
      emit()
      schedule()
    }, nextMinuteDelay(environment.now()))
  }
  const refresh = () => {
    emit()
    schedule()
  }

  return {
    getSnapshot: () => value,
    activeTimerCount: () => timer === null ? 0 : 1,
    refresh,
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        removeEvents = [environment.listen('focus', refresh), environment.listen('visibilitychange', refresh)]
        refresh()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        stopTimer()
        for (const remove of removeEvents) remove()
        removeEvents = []
      }
    },
  }
}

const browserEnvironment: ClockEnvironment = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
  hidden: () => typeof document !== 'undefined' && document.hidden,
  listen: (type, listener) => {
    const target = type === 'focus' ? globalThis.window : globalThis.document
    target?.addEventListener(type, listener)
    return () => target?.removeEventListener(type, listener)
  },
}

export const farmPresentationClock = createFarmPresentationClock(browserEnvironment)

export function useFarmPresentationNow(): number {
  return useSyncExternalStore(
    farmPresentationClock.subscribe,
    farmPresentationClock.getSnapshot,
    farmPresentationClock.getSnapshot,
  )
}
