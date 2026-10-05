// @vitest-environment jsdom
import type { BattleCue } from '@racer/domain'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBattlePlayback } from './useBattlePlayback'

let frame: FrameRequestCallback | null = null
const cues: BattleCue[] = [{ kind: 'hit', actorId: 'a', targetId: 'b', amount: 10, channel: 'physical', element: null, matchup: 'neutral' }, { kind: 'ko', actorId: 'a', targetId: 'b' }]
beforeEach(() => {
  frame = null
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { frame = next; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => { frame = null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('read-only delta-timed cue playback', () => {
  it.each([60, 120])('preserves cue order and duration at %i Hz', async (hz) => {
    const { result } = renderHook(() => useBattlePlayback(false))
    let done: Promise<void> = Promise.resolve()
    act(() => { done = result.current.play(cues) })
    expect(result.current.cue).toEqual(cues[0])
    for (let timestamp = 0; timestamp < 420; timestamp += 1_000 / hz) act(() => { frame?.(timestamp) })
    act(() => { frame?.(421) })
    expect(result.current.cue).toEqual(cues[1])
    await act(async () => { frame?.(841); await done })
    expect(result.current.playing).toBe(false)
  })
  it('skip, orientation and background finish playback without adding actions', async () => {
    const { result } = renderHook(() => useBattlePlayback(false))
    for (const stop of [() => result.current.skip(), () => window.dispatchEvent(new Event('orientationchange')),
      () => { vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')) }]) {
      let done: Promise<void> = Promise.resolve()
      act(() => { done = result.current.play(cues) })
      await act(async () => { stop(); await done })
      expect(result.current.playing).toBe(false)
      expect(result.current.cue).toBeNull()
    }
  })
  it('reduced motion completes immediately', async () => {
    const { result } = renderHook(() => useBattlePlayback(true))
    await act(async () => { await result.current.play(cues) })
    expect(result.current.playing).toBe(false)
    expect(frame).toBeNull()
  })
})
