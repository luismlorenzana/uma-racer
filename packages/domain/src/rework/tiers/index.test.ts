// `@racer/domain/rework/tiers` is the area's index: its rules, plus the shared shapes and the time factor for
// scripts/sim (docs/game/architecture.md#the-rework-modules). Pins the durations the rework pages quote (D338).
import { describe, expect, it } from 'vitest'
import * as tiers from './index'

describe('the tiers entry', () => {
  it('re-exports the shared shapes and the time factor', () => {
    expect(tiers.TIME_FACTOR).toBe(1.2)
    expect(typeof tiers.refuse).toBe('function')
    expect(typeof tiers.emptyBuild).toBe('function')
    expect(typeof tiers.applyRaceFinish).toBe('function')
    expect(typeof tiers.promote).toBe('function')
    expect(tiers.TIER_REFUSALS['busy']).toBeTruthy()
  })

  it('times a session, a cook and a craft at k = 1.2', () => {
    expect([180, 315, 22.5, 240].map((minutes) => tiers.workSeconds(minutes))).toEqual([12_960, 22_680, 1_620, 17_280])
    expect(tiers.workSeconds(180, 1.25)).toBe(10_368)
  })
})
