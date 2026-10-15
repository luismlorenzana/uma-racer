// The shell's one clock (docs/game/11-hub-and-places.md §4; docs/game/02-check-ins-and-notifications.md §8): pips
// and labels redraw every 30 seconds and on return to the app, never per frame, and nothing writes on a tick. It stops
// while the page is hidden.

export const CLOCK_MS = 30_000

export interface Clock {
  get(): number
  subscribe(listener: () => void): () => void
  /** Reads the source now; listeners hear only a change. */
  tick(): void
}

interface Host {
  readonly document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  readonly setInterval: (run: () => void, ms: number) => unknown
  readonly clearInterval: (handle: unknown) => void
}

const browser = (): Host => ({
  document: typeof document === 'undefined' ? undefined : document,
  setInterval: (run, ms) => globalThis.setInterval(run, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
})

export function createClock(source: () => number, host: Host = browser(), periodMs = CLOCK_MS): Clock {
  let value = source()
  const listeners = new Set<() => void>()
  let timer: unknown = null

  const tick = () => {
    const next = source()
    if (next === value) return
    value = next
    for (const listener of [...listeners]) listener()
  }
  const hidden = () => host.document?.visibilityState === 'hidden'
  const start = () => {
    if (timer === null && !hidden()) timer = host.setInterval(tick, periodMs)
  }
  const stop = () => {
    if (timer !== null) host.clearInterval(timer)
    timer = null
  }
  const onVisibility = () => {
    if (hidden()) stop()
    else {
      tick()
      start()
    }
  }

  return {
    get: () => value,
    tick,
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        host.document?.addEventListener('visibilitychange', onVisibility)
        tick()
        start()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stop()
          host.document?.removeEventListener('visibilitychange', onVisibility)
        }
      }
    },
  }
}
