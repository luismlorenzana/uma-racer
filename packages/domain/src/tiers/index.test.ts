// `@racer/domain/tiers` is the area's index: its rules (docs/game/architecture.md#the-rework-modules).
import { describe, expect, it } from 'vitest'
import * as tiers from './index'

describe('the tiers entry', () => {
  it("exports the area's rules", () => {
    expect(typeof tiers.applyRaceFinish).toBe('function')
    expect(typeof tiers.promote).toBe('function')
    expect(tiers.TIER_REFUSALS['busy']).toBeTruthy()
  })
})
