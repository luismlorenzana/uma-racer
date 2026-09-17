import { describe, expect, it } from 'vitest'
import {
  COURSE_WIDTH,
  HORSE_LANE,
  chooseTargetLane,
  frontBlocker,
  overtakeTarget,
  positionKeepWitChance,
  positionThresholds,
  type PackRunnerSnapshot,
} from './index'

const snapshot = (index: number, overrides: Partial<PackRunnerSnapshot> = {}): PackRunnerSnapshot => ({
  index,
  distance: 100,
  speed: 20,
  targetSpeed: 21,
  power: 600,
  wit: 600,
  strategy: 'pace',
  lane: HORSE_LANE,
  hpEmpty: false,
  hasSpeedEffect: false,
  ...overrides,
})

describe('R3 pack helpers', () => {
  it('pins the strategy thresholds and bounded Wit checks', () => {
    expect(positionThresholds('pace', 2_400)[1]).toBeCloseTo(10.6)
    expect(positionThresholds('late', 2_400)).toEqual(expect.arrayContaining([expect.closeTo(13.78), expect.closeTo(14.84)]))
    expect(positionThresholds('end', 2_400)).toEqual(expect.arrayContaining([expect.closeTo(15.9), expect.closeTo(16.96)]))
    expect(positionKeepWitChance(600, 20)).toBeCloseTo(0.3556, 3)
    expect(positionKeepWitChance(1, 15)).toBe(0)
  })

  it('selects the closest legal front blocker with a stable index tie break', () => {
    const owner = snapshot(0, { lane: HORSE_LANE })
    const far = snapshot(1, { distance: 101.5, lane: HORSE_LANE })
    const close = snapshot(2, { distance: 100.5, lane: HORSE_LANE })
    expect(frontBlocker(owner, [owner, far, close])?.index).toBe(2)
    expect(frontBlocker(owner, [owner, snapshot(3, { distance: 102.01 })])).toBeNull()
  })

  it('chooses a legal passing side and refuses occupied candidates', () => {
    const owner = snapshot(0, { lane: 2 * HORSE_LANE, speed: 22, targetSpeed: 23 })
    const target = snapshot(1, { distance: 105, lane: 2 * HORSE_LANE, speed: 20, targetSpeed: 20 })
    expect(overtakeTarget(owner, [owner, target], null)?.index).toBe(1)
    expect(chooseTargetLane(owner, target, 1, 'normal', [owner, target])).toBe(HORSE_LANE)
    const insideBlocker = snapshot(2, { distance: 102, lane: HORSE_LANE })
    expect(chooseTargetLane(owner, target, 1, 'normal', [owner, target, insideBlocker])).toBe(3 * HORSE_LANE)
  })

  it('keeps every candidate lane inside the physical course', () => {
    const owner = snapshot(0, { lane: COURSE_WIDTH })
    const target = snapshot(1, { distance: 105, lane: COURSE_WIDTH })
    expect(chooseTargetLane(owner, target, 2, 'normal', [owner, target])).toBe(COURSE_WIDTH - HORSE_LANE)
  })
})
