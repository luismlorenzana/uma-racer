import { describe, expect, it } from 'vitest'
import { extractTimelineAccomplishmentFacts } from './accomplishments'
import type { RaceTimeline } from './types'

function timeline(overrides: Partial<RaceTimeline> = {}): RaceTimeline {
  return {
    tickRate: 15,
    ticks: 3,
    runnerCount: 2,
    courseDistance: 24,
    distance: new Float32Array([0, 0, 12, 10, 24, 23]),
    speed: new Float32Array(6),
    hp: new Float32Array(6),
    events: [
      { tick: 1, runner: 0, type: 'spurt' },
      { tick: 2, runner: 0, type: 'skill-activated', skillId: 'synthetic-inherited' },
    ],
    results: [
      { runner: 0, id: 'player', placement: 1, finishTime: 1, marginLengths: 0, startDelay: 0.04, spurtSpeed: 20, spurtMaxed: true },
      { runner: 1, id: 'rival', placement: 2, finishTime: 1.1, marginLengths: 1, startDelay: 0.02, spurtSpeed: 19, spurtMaxed: false },
    ],
    ...overrides,
  }
}

describe('timeline accomplishment extraction', () => {
  it('derives completed checkpoints, first-spurt placement, start delay, and inherited activation', () => {
    expect(extractTimelineAccomplishmentFacts({
      timeline: timeline(),
      playerIndex: 0,
      gates: [1, 0],
      inheritedUniqueSkillIds: new Set(['synthetic-inherited']),
    })).toEqual({
      playerStartDelay: 0.04,
      playerFinalSpurtPlacement: 1,
      ledEverySectionCheckpoint: true,
      inheritedUniqueActivated: true,
    })
  })

  it('uses gate order for distance ties and only evaluates checkpoint samples that exist', () => {
    const short = timeline({
      ticks: 2,
      distance: new Float32Array([0, 0, 12, 10]),
      speed: new Float32Array(4),
      hp: new Float32Array(4),
      events: [{ tick: 0, runner: 0, type: 'spurt' }],
    })
    expect(extractTimelineAccomplishmentFacts({
      timeline: short,
      playerIndex: 0,
      gates: [1, 0],
      inheritedUniqueSkillIds: new Set(),
    })).toMatchObject({ playerFinalSpurtPlacement: 2, ledEverySectionCheckpoint: true, inheritedUniqueActivated: false })
  })

  it('rejects an invalid player or gate order', () => {
    expect(() => extractTimelineAccomplishmentFacts({ timeline: timeline(), playerIndex: 2, gates: [0, 1], inheritedUniqueSkillIds: new Set() })).toThrow(/player index/)
    expect(() => extractTimelineAccomplishmentFacts({ timeline: timeline(), playerIndex: 0, gates: [0, 0], inheritedUniqueSkillIds: new Set() })).toThrow(/gate order/)
  })
})
