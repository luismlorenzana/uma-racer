import type { RaceTimeline } from '@racer/race'
import { describe, expect, it } from 'vitest'
import {
  PHOTO_HOLD_SECONDS,
  PRE_ROLL_SECONDS,
  REDUCED_PRE_ROLL_SECONDS,
  RacePlaybackClock,
  activeRaceCue,
  buildRaceCues,
  coursePositionLabel,
  isPhotoFinish,
  summarizePlayerActivations,
} from './presentation'

const timeline = (overrides: Partial<RaceTimeline> = {}): RaceTimeline => ({
  tickRate: 10,
  ticks: 101,
  runnerCount: 3,
  courseDistance: 1_000,
  distance: new Float32Array(303),
  speed: new Float32Array(303),
  hp: new Float32Array(303),
  events: [],
  results: [
    { runner: 0, id: 'a', placement: 1, finishTime: 10, marginLengths: 0, startDelay: 0, spurtSpeed: 20, spurtMaxed: true },
    { runner: 1, id: 'b', placement: 2, finishTime: 10.1, marginLengths: 0.1, startDelay: 0, spurtSpeed: 20, spurtMaxed: true },
    { runner: 2, id: 'c', placement: 3, finishTime: 10.2, marginLengths: 0.2, startDelay: 0, spurtSpeed: 20, spurtMaxed: true },
  ],
  ...overrides,
})

describe('race presentation clock', () => {
  it('keeps simulation at zero through the staged normal pre-roll', () => {
    const clock = new RacePlaybackClock(10, false, false)
    expect(clock.snapshot()).toMatchObject({ stage: 'field', simSeconds: 0, done: false })
    expect(clock.advance(0.9, 2)).toMatchObject({ stage: 'staged', simSeconds: 0 })
    expect(clock.advance(PRE_ROLL_SECONDS - 0.9, 2)).toMatchObject({ stage: 'running', simSeconds: 0 })
    expect(clock.advance(0.5, 2)).toMatchObject({ stage: 'running', simSeconds: 1 })
  })

  it('shortens reduced motion and removes the close-finish slowdown and hold', () => {
    const clock = new RacePlaybackClock(10, true, true)
    expect(clock.advance(0.3, 1).stage).toBe('ready')
    expect(clock.advance(REDUCED_PRE_ROLL_SECONDS - 0.3, 1).simSeconds).toBe(0)
    expect(clock.advance(10, 1)).toEqual({ stage: 'finished', simSeconds: 10, done: true })
  })

  it('slows and holds a close finish, while skip and replay seek finish immediately', () => {
    const clock = new RacePlaybackClock(10, true, false)
    clock.advance(PRE_ROLL_SECONDS + 9.2, 1)
    expect(clock.snapshot()).toMatchObject({ stage: 'running', simSeconds: 9.2 })
    expect(clock.advance(1, 1).simSeconds).toBeCloseTo(9.6)
    expect(clock.advance(1, 1)).toMatchObject({ stage: 'photo', simSeconds: 10, done: false })
    expect(clock.advance(PHOTO_HOLD_SECONDS, 1)).toEqual({ stage: 'finished', simSeconds: 10, done: true })
    expect(new RacePlaybackClock(10, true, false).skip()).toEqual({ stage: 'finished', simSeconds: 10, done: true })
    expect(new RacePlaybackClock(10, true, false).seek(10)).toEqual({ stage: 'finished', simSeconds: 10, done: true })
  })
})

describe('race cue scheduling', () => {
  it('prioritizes player cues, groups simultaneous rivals, and never overlaps popups', () => {
    const cues = buildRaceCues(timeline({ events: [
      { tick: 10, runner: 2, type: 'skill-activated', skillId: 'rival-b', skillEffects: ['target-speed'] },
      { tick: 10, runner: 1, type: 'skill-activated', skillId: 'rival-a', skillEffects: ['acceleration'] },
      { tick: 10, runner: 0, type: 'skill-activated', skillId: 'player', skillEffects: ['recovery'] },
      { tick: 20, runner: 0, type: 'blocked', value: 1 },
      { tick: 25, runner: 0, type: 'overtake', value: 1 },
      { tick: 30, runner: 0, type: 'blocked', value: 0 },
      { tick: 35, runner: 0, type: 'blocked', value: 1 },
      { tick: 55, runner: 0, type: 'blocked', value: 1 },
    ] }), 0)
    expect(cues[0]).toMatchObject({ kind: 'skill', skillId: 'player', isPlayer: true, startSeconds: 1 })
    expect(cues.find((cue) => !cue.isPlayer && cue.kind === 'skill')).toMatchObject({ runner: 1, additionalCount: 1 })
    expect(cues.filter((cue) => cue.packKind === 'Blocked')).toHaveLength(2)
    for (let index = 1; index < cues.length; index += 1) {
      expect(cues[index]!.startSeconds).toBeGreaterThanOrEqual(cues[index - 1]!.endSeconds)
    }
    expect(activeRaceCue(cues, 1.1)?.skillId).toBe('player')
  })

  it('summarizes player effects without leaking rival activations', () => {
    const input = timeline({ events: [
      { tick: 1, runner: 0, type: 'skill-activated', skillId: 'synthetic-a', skillEffects: ['recovery'] },
      { tick: 2, runner: 0, type: 'skill-activated', skillId: 'synthetic-a', skillEffects: ['target-speed'] },
      { tick: 3, runner: 1, type: 'skill-activated', skillId: 'synthetic-rival', skillEffects: ['acceleration'] },
    ] })
    expect(summarizePlayerActivations(input, 0)).toEqual([
      { skillId: 'synthetic-a', count: 2, effects: ['recovery', 'target-speed'] },
    ])
  })
})

describe('race position presentation', () => {
  it('uses exact Nose/Head photo boundaries and snapshot course labels', () => {
    expect(isPhotoFinish(timeline())).toBe(true)
    expect(isPhotoFinish(timeline({ results: timeline().results.map((result, index) => index === 1 ? { ...result, marginLengths: 0.15 } : result) }))).toBe(false)
    const layout = {
      corners: [{ start: 200, end: 300, number: 1 }, { start: 600, end: 700, number: 2 }],
      straights: [{ start: 0, end: 200 }, { start: 300, end: 600 }, { start: 700, end: 1_000 }],
    }
    expect(coursePositionLabel(layout, 250)).toBe('Corner 1')
    expect(coursePositionLabel(layout, 650)).toBe('Final corner')
    expect(coursePositionLabel(layout, 800)).toBe('Final straight')
    expect(coursePositionLabel(undefined, 800)).toBeNull()
    const hilly = { ...layout, slopes: [{ start: 600, end: 700, slope: 15_000 }, { start: 750, end: 900, slope: -10_000 }] }
    expect(coursePositionLabel(hilly, 650)).toBe('Final corner · Uphill')
    expect(coursePositionLabel(hilly, 800)).toBe('Final straight · Downhill')
  })

  it('cues the player\'s duel and names her rival (engine v5)', () => {
    const cues = buildRaceCues(timeline({ events: [{ tick: 40, runner: 0, type: 'duel', value: 1, targetRunner: 2 }] }), 0)
    expect(cues).toEqual([expect.objectContaining({ kind: 'duel', runner: 2, isPlayer: true })])
    expect(buildRaceCues(timeline({ events: [{ tick: 40, runner: 0, type: 'duel', value: 0 }] }), 0)).toEqual([])
  })
})
