import type { RaceTimeline } from '@racer/race'
import { describe, expect, it } from 'vitest'
import {
  PHOTO_HOLD_SECONDS,
  PRE_ROLL_SECONDS,
  RACE_FEED_SLOTS,
  REDUCED_PRE_ROLL_SECONDS,
  RacePlaybackClock,
  TURN_RACE_RATE,
  buildRaceCues,
  coursePositionLabel,
  isPhotoFinish,
  liveRaceCues,
  summarizePlayerActivations,
  type RaceCue,
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

const mostLive = (cues: readonly RaceCue[]) => Math.max(0, ...cues.map((cue) => liveRaceCues(cues, cue.startSeconds).length))

describe('race feed scheduling (D178)', () => {
  it('shows every cue at its own moment, newest first, with rivals folded into one toast', () => {
    const cues = buildRaceCues(timeline({ events: [
      { tick: 10, runner: 2, type: 'skill-activated', skillId: 'rival-b', skillEffects: ['target-speed'] },
      { tick: 10, runner: 1, type: 'skill-activated', skillId: 'rival-a', skillEffects: ['acceleration'] },
      { tick: 10, runner: 0, type: 'skill-activated', skillId: 'player', skillEffects: ['recovery'] },
      { tick: 14, runner: 2, type: 'skill-activated', skillId: 'rival-c' },
      { tick: 20, runner: 0, type: 'blocked', value: 1 },
      { tick: 25, runner: 0, type: 'overtake', value: 1 },
      { tick: 30, runner: 0, type: 'blocked', value: 0 },
      { tick: 35, runner: 0, type: 'blocked', value: 1 },
      { tick: 55, runner: 0, type: 'blocked', value: 1 },
    ] }), 0)
    expect(cues[0]).toMatchObject({ kind: 'skill', skillId: 'player', isPlayer: true, startSeconds: 1, endSeconds: 3 })
    // One rival toast, from the lowest gate, counting the others as they happen.
    expect(cues.filter((cue) => !cue.isPlayer)).toEqual([expect.objectContaining({ runner: 1, skillId: 'rival-a', folded: [1, 1.4] })])
    // Nothing waits: a cue starts when its event happens, so the second Blocked (3 s quiet) is at 5.5 s, not later.
    expect(cues.filter((cue) => cue.packKind === 'Blocked').map((cue) => cue.startSeconds)).toEqual([2, 5.5])
    expect(cues.find((cue) => cue.packKind === 'Overtaking')?.startSeconds).toBe(2.5)
    expect(liveRaceCues(cues, 2.6).map((cue) => cue.packKind ?? cue.skillId)).toEqual(['Overtaking', 'Blocked', 'player'])
    expect(new Set(cues.map((cue) => cue.id)).size).toBe(cues.length)
  })

  it('never shows more than three: player moments push out the rival toast, then the oldest', () => {
    const cues = buildRaceCues(timeline({ events: [
      { tick: 0, runner: 1, type: 'skill-activated', skillId: 'rival' },
      { tick: 1, runner: 0, type: 'skill-activated', skillId: 'first' },
      { tick: 2, runner: 0, type: 'skill-activated', skillId: 'second' },
      { tick: 3, runner: 0, type: 'skill-activated', skillId: 'third' },
      { tick: 4, runner: 0, type: 'skill-activated', skillId: 'fourth' },
      { tick: 5, runner: 2, type: 'skill-activated', skillId: 'late-rival' },
    ] }), 0)
    expect(mostLive(cues)).toBe(RACE_FEED_SLOTS)
    expect(cues.find((cue) => cue.skillId === 'rival')?.endSeconds).toBe(0.3)
    expect(cues.find((cue) => cue.skillId === 'first')?.endSeconds).toBe(0.4)
    expect(liveRaceCues(cues, 0.45).map((cue) => cue.skillId)).toEqual(['fourth', 'third', 'second'])
    // A rival with the feed full of her moments is not shown at all.
    expect(cues.some((cue) => cue.skillId === 'late-rival')).toBe(false)
  })

  it('drops a rival cue of another kind rather than queueing it', () => {
    const cues = buildRaceCues(timeline({ events: [
      { tick: 0, runner: 1, type: 'late-start', value: 0.2 },
      { tick: 0, runner: 2, type: 'late-start', value: 0.3 },
      { tick: 0, runner: 2, type: 'skill-activated', skillId: 'rival' },
    ] }), 0)
    expect(cues).toEqual([expect.objectContaining({ kind: 'late-start', runner: 1, folded: [0] })])
  })

  it('keeps a toast up as long in a turn race as in a timed one, at 1×', () => {
    const cues = buildRaceCues(timeline({ tickRate: 1, events: [{ tick: 5, runner: 0, type: 'spurt', value: 1 }] }), 0)
    expect(cues[0]).toMatchObject({ startSeconds: 5, endSeconds: 5 + 1.6 * TURN_RACE_RATE })
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
