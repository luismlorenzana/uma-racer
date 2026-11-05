// Guards the numbers the manual states against drift (D381: what the restart keeps). If a page changes, change the
// matching expectation here.
import { describe, expect, it } from 'vitest'
import {
  CARD_FOCUS_MIN_SHARE,
  CARD_FOCUS_MIN_SKILLS,
  GRADE_HANDICAP,
  SCENARIOS,
  cardRaceBonus,
  compileRaceSkill,
  distanceCategory,
  eraOf,
  raceFieldSize,
  skillPointCap,
  SKILL_ACTIVATION_MIN,
  SKILL_ACTIVATION_WIT_DIVISOR,
  COURSE_WIDTH,
  FRONT_BLOCK_DISTANCE,
  FRONT_BLOCK_LANE_FACTOR,
  FRONT_LEAD_METERS,
  FRONT_OVERTAKE_COEF,
  FRONT_OVERTAKE_EXIT_METERS,
  FRONT_SPEED_UP_COEF,
  HORSE_LANE,
  LANE_ACCELERATION,
  MAX_LANE_SPEED,
  NEAR_DISTANCE,
  NEAR_LANES,
  OVERLAP_DISTANCE,
  OVERLAP_LANES,
  PACE_UP_EX_COEF,
  PACE_DOWN_MIDDLE_COEF,
  PACE_DOWN_OPENING_COEF,
  PACE_UP_COEF,
  POSITION_KEEP_CHECK_SECONDS,
  POSITION_KEEP_COOLDOWN_SECONDS,
  POSITION_KEEP_LAST_SECTION,
  SIDE_BLOCK_DISTANCE,
  SIDE_BLOCK_LANES,
  SOLO_FRONT_LEAD_METERS,
  VISIBLE_DISTANCE,
} from './index'

describe('card focus', () => {
  it('pins the D201 rule: at least two skills and 30% of them', () => {
    expect([CARD_FOCUS_MIN_SKILLS, CARD_FOCUS_MIN_SHARE]).toEqual([2, 0.3])
  })
})

describe('scenarios', () => {
  it('pins inherited unique strength: the inherited record races at its own values (D174)', () => {
    const inherited = compileRaceSkill({
      id: 'synthetic-gene', kind: 'inherited-unique', name: 'Synthetic', description: '', costSp: 100, iconId: null,
      inheritedSkillId: null, normalSkillId: null, conditions: [{ precondition: null, condition: 'always==1', baseTime: 10_000, cooldown: 0, effects: [{ type: 22, value: 10_000 }] }],
    })
    expect(inherited.groups[0]?.effects[0]?.amount).toBe(1)
  })

  it('pins all 15 JP scenarios, the 15th Goshiki Shuntaisai (D381), and the SP cap ladder', () => {
    expect(SCENARIOS.map((scenario) => [scenario.tier, scenario.jpRelease])).toEqual([
      [1, '2021-02-24'], [2, '2021-08-30'], [3, '2022-02-24'], [4, '2022-08-24'],
      [5, '2023-02-24'], [6, '2023-08-24'], [7, '2024-02-24'], [8, '2024-06-26'],
      [9, '2024-10-29'], [10, '2025-02-24'], [11, '2025-06-27'], [12, '2025-10-29'],
      [13, '2026-02-24'], [14, '2026-06-29'], [15, '2026-10-26'],
    ])
    expect(SCENARIOS[14]?.name).toBe('Goshiki Shuntaisai')
    // D133: grounded at tiers 2–3 (Unity Cup ~2,000–2,500, Trackblazer ~2,800), drafted elsewhere.
    expect([skillPointCap(1), skillPointCap(3), skillPointCap(14), skillPointCap(15)]).toEqual([2000, 2800, 5000, 5200])
  })

  it('assigns card eras by JP release date', () => {
    expect(eraOf('2021-02-24')).toBe(1)
    expect(eraOf('2021-08-29')).toBe(1)
    expect(eraOf('2023-03-01')).toBe(5)
    expect(['2025-10-28', '2025-10-29', '2026-06-28', '2026-06-29', '2026-10-25', '2026-10-26'].map(eraOf)).toEqual([11, 12, 13, 14, 14, 15])
  })

  it('categorizes distances', () => {
    expect(distanceCategory(1400)).toBe('sprint')
    expect(distanceCategory(1800)).toBe('mile')
    expect(distanceCategory(2400)).toBe('medium')
    expect(distanceCategory(2500)).toBe('long')
  })
})

describe('races', () => {
  it('pads a small field to eight and handicaps G3 most, then G2, then G1', () => {
    expect(raceFieldSize({ fieldSize: 5 })).toBe(8)
    expect(raceFieldSize({ fieldSize: 18 })).toBe(18)
    expect(GRADE_HANDICAP.g3).toBeGreaterThan(GRADE_HANDICAP.g2)
    expect(GRADE_HANDICAP.g2).toBeGreaterThan(GRADE_HANDICAP.g1)
  })
})

describe('cards', () => {
  it('reads Race Bonus from the real value, a percentage, plus the unique effect\'s (D381)', () => {
    expect(cardRaceBonus({ effects: { 15: 10 }, uniqueEffect: null })).toBeCloseTo(0.1)
    expect(cardRaceBonus({ effects: { 15: 5 }, uniqueEffect: { level: 30, description: null, effects: [{ type: 15, value: 5, params: [] }] } })).toBeCloseTo(0.1)
    expect(cardRaceBonus({ effects: {}, uniqueEffect: null })).toBe(0)
  })
})

describe('race skills', () => {
  it('pins the researched Wit activation curve', () => {
    expect(SKILL_ACTIVATION_MIN).toBe(0.2)
    expect(SKILL_ACTIVATION_WIT_DIVISOR).toBe(90)
  })

  it('pins every documented R3 pack coefficient', () => {
    expect({
      courseWidth: COURSE_WIDTH,
      horseLane: HORSE_LANE,
      lastSection: POSITION_KEEP_LAST_SECTION,
      checkSeconds: POSITION_KEEP_CHECK_SECONDS,
      cooldownSeconds: POSITION_KEEP_COOLDOWN_SECONDS,
      frontSpeedUp: FRONT_SPEED_UP_COEF,
      frontOvertake: FRONT_OVERTAKE_COEF,
      paceUp: PACE_UP_COEF,
      paceUpEx: PACE_UP_EX_COEF,
      paceDownOpening: PACE_DOWN_OPENING_COEF,
      paceDownMiddle: PACE_DOWN_MIDDLE_COEF,
      frontLeadMeters: FRONT_LEAD_METERS,
      soloFrontLeadMeters: SOLO_FRONT_LEAD_METERS,
      frontOvertakeExitMeters: FRONT_OVERTAKE_EXIT_METERS,
      frontBlockDistance: FRONT_BLOCK_DISTANCE,
      frontBlockLaneFactor: FRONT_BLOCK_LANE_FACTOR,
      sideBlockDistance: SIDE_BLOCK_DISTANCE,
      sideBlockLanes: SIDE_BLOCK_LANES,
      overlapDistance: OVERLAP_DISTANCE,
      overlapLanes: OVERLAP_LANES,
      nearDistance: NEAR_DISTANCE,
      nearLanes: NEAR_LANES,
      visibleDistance: VISIBLE_DISTANCE,
      laneAcceleration: LANE_ACCELERATION,
      maxLaneSpeed: MAX_LANE_SPEED,
    }).toEqual({
      courseWidth: 11.25,
      horseLane: 0.625,
      lastSection: 9,
      checkSeconds: 2,
      cooldownSeconds: 1,
      frontSpeedUp: 1.04,
      frontOvertake: 1.05,
      paceUp: 1.04,
      paceUpEx: 2,
      paceDownOpening: 0.915,
      paceDownMiddle: 0.945,
      frontLeadMeters: 4.5,
      soloFrontLeadMeters: 12.5,
      frontOvertakeExitMeters: 10,
      frontBlockDistance: 2,
      frontBlockLaneFactor: 0.75,
      sideBlockDistance: 1.05,
      sideBlockLanes: 2,
      overlapDistance: 0.4,
      overlapLanes: 0.4,
      nearDistance: 3,
      nearLanes: 3,
      visibleDistance: 20,
      laneAcceleration: 0.03,
      maxLaneSpeed: 0.6,
    })
  })
})
