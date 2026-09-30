import { describe, expect, it, vi } from 'vitest'
import { createFarmPresentationClock } from './presentation-clock'

describe('Farm presentation clock', () => {
  it('shares one minute-aligned timer, pauses while hidden and cleans up', () => {
    let now = 120_010
    let hidden = false
    const callbacks = new Map<number, () => void>()
    const events = new Map<string, () => void>()
    const delays: number[] = []
    let sequence = 0
    const clearTimeout = vi.fn((id: number) => { callbacks.delete(id) })
    const clock = createFarmPresentationClock({
      now: () => now,
      hidden: () => hidden,
      setTimeout: (callback, delay) => {
        delays.push(delay)
        const id = ++sequence
        callbacks.set(id, callback)
        return id as unknown as ReturnType<typeof globalThis.setTimeout>
      },
      clearTimeout: (timer) => clearTimeout(timer as unknown as number),
      listen: (type, listener) => {
        events.set(type, listener)
        return () => { events.delete(type) }
      },
    })
    const first = vi.fn()
    const second = vi.fn()
    const removeFirst = clock.subscribe(first)
    const removeSecond = clock.subscribe(second)
    expect(clock.activeTimerCount()).toBe(1)
    expect(callbacks.size).toBe(1)
    expect(delays).toEqual([59_990])

    hidden = true
    now += 10
    events.get('visibilitychange')?.()
    expect(clock.activeTimerCount()).toBe(0)
    expect(clock.getSnapshot()).toBe(now)

    hidden = false
    events.get('visibilitychange')?.()
    expect(clock.activeTimerCount()).toBe(1)
    expect(delays).toEqual([59_990, 59_980])
    removeFirst()
    expect(clock.activeTimerCount()).toBe(1)
    removeSecond()
    expect(clock.activeTimerCount()).toBe(0)
    expect(events.size).toBe(0)
    expect(clearTimeout).toHaveBeenCalled()
  })
})
