import { describe, expect, it } from 'vitest'
import { buildScenarioModifierView, climaxRewardLabel } from './scenario-modifier-view'

describe('scenario modifier view projection', () => {
  it('projects active progress, completed identity, and legacy-null messaging', () => {
    expect(buildScenarioModifierView(1, null, true)).toBeNull()
    expect(buildScenarioModifierView(2, { version: 1, tier: 2, kind: 'team-spirit', bursts: 1 }, true)).toMatchObject({
      name: 'Team Spirit',
      detail: '1 Spirit Burst triggered this tier.',
      legacyUnavailable: false,
    })
    expect(buildScenarioModifierView(3, { version: 1, tier: 3, kind: 'climax', earned: 4, stock: 1, used: 3 }, true)).toMatchObject({
      name: 'Climax',
      detail: '1 stocked · 3 used · expires at promotion.',
      legacyUnavailable: false,
    })
    expect(buildScenarioModifierView(2, null, true)).toMatchObject({ legacyUnavailable: true, detail: expect.stringMatching(/Legacy run/) })
    expect(buildScenarioModifierView(2, null, false)).toMatchObject({ legacyUnavailable: false, detail: 'Tier-local progress expired at promotion.' })
  })

  it('labels only newly awarded Climax items', () => {
    expect(climaxRewardLabel(0)).toBeNull()
    expect(climaxRewardLabel(1)).toBe('+1 Climax training item')
    expect(climaxRewardLabel(2)).toBe('+2 Climax training items')
  })
})
