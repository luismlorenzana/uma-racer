// `@racer/domain/state` is the shared shapes and the time factor (docs/game/architecture.md#the-rework-modules). Pins the
// durations the rework pages quote (D338).
import { describe, expect, it } from 'vitest'
import * as state from './index'

describe('the state entry', () => {
  it('exports the shared shapes and the time factor', () => {
    expect(state.TIME_FACTOR).toBe(1.2)
    expect(typeof state.refuse).toBe('function')
    expect(typeof state.emptyBuild).toBe('function')
  })

  it('times a session, a cook and a craft at k = 1.2', () => {
    expect([180, 315, 22.5, 240].map((minutes) => state.workSeconds(minutes))).toEqual([12_960, 22_680, 1_620, 17_280])
    expect(state.workSeconds(180, 1.25)).toBe(10_368)
  })
})
