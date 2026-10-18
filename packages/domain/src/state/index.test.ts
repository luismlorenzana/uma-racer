// `@racer/domain/state` is the shared shapes and the time factor (docs/game/architecture.md#the-rework-modules). Pins the
// durations the rework pages quote (D338, D374).
import { describe, expect, it } from 'vitest'
import * as state from './index'

describe('the state entry', () => {
  it('exports the shared shapes and the time factor', () => {
    expect(state.TIME_FACTOR).toBe(1.8)
    expect(typeof state.refuse).toBe('function')
    expect(typeof state.emptyBuild).toBe('function')
  })

  it('times a session, a cook and a craft at k = 1.8', () => {
    expect([180, 315, 22.5, 240].map((minutes) => state.workSeconds(minutes))).toEqual([19_440, 34_020, 2_430, 25_920])
    expect(state.workSeconds(180, 1.25)).toBe(15_552)
  })
})
