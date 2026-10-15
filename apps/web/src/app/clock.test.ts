// The shell's one clock (game/11 §4, 02 §8): a 30-second tick that stops while the page is hidden and ticks again on
// return, reading the port's time; listeners hear only a change.
import { describe, expect, it, vi } from 'vitest'
import { CLOCK_MS, createClock } from './clock'

function host() {
  const timers = new Map<number, () => void>()
  let next = 0
  const listeners = new Set<() => void>()
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }
  return {
    timers,
    listeners,
    doc,
    host: {
      document: doc as unknown as Document,
      setInterval: (run: () => void, ms: number) => {
        expect(ms).toBe(CLOCK_MS)
        timers.set((next += 1), run)
        return next
      },
      clearInterval: (handle: unknown) => void timers.delete(handle as number),
    },
    fire: () => { for (const run of [...timers.values()]) run() },
    show: (state: DocumentVisibilityState) => {
      doc.visibilityState = state
      for (const listener of [...listeners]) listener()
    },
  }
}

describe('the clock', () => {
  it('ticks every 30 seconds while someone listens, and stops after the last leaves', () => {
    let now = 100
    const fake = host()
    const clock = createClock(() => now, fake.host)
    const heard = vi.fn()
    const leave = clock.subscribe(heard)
    expect(fake.timers.size).toBe(1)
    now = 30_100
    fake.fire()
    expect(clock.get()).toBe(30_100)
    expect(heard).toHaveBeenCalledTimes(1)
    fake.fire()
    expect(heard).toHaveBeenCalledTimes(1)
    leave()
    expect(fake.timers.size).toBe(0)
    expect(fake.listeners.size).toBe(0)
  })

  it('stops while the page is hidden, and ticks again on return', () => {
    let now = 0
    const fake = host()
    const clock = createClock(() => now, fake.host)
    clock.subscribe(() => {})
    fake.show('hidden')
    expect(fake.timers.size).toBe(0)
    now = 3_600_000
    expect(clock.get()).toBe(0)
    fake.show('visible')
    expect(clock.get()).toBe(3_600_000)
    expect(fake.timers.size).toBe(1)
  })

  it('reads the source on demand, so a tap shows at once', () => {
    let now = 5
    const clock = createClock(() => now, host().host)
    now = 9
    clock.tick()
    expect(clock.get()).toBe(9)
  })
})
