import type { RaceCourseLayout, RaceSkillEffectKind } from '@racer/domain'
import { sampleTimeline, type RaceEvent, type RaceTimeline } from '@racer/race'

// Pure renderer choreography derived from immutable race output
// (docs/design/racing.md#presentation-the-race-on-its-own-course).

export const PRE_ROLL_SECONDS = 2.4
export const REDUCED_PRE_ROLL_SECONDS = 0.6
export const PHOTO_SLOW_SECONDS = 0.8
export const PHOTO_SPEED = 0.4
export const PHOTO_HOLD_SECONDS = 0.65

export type RacePresentationStage = 'field' | 'staged' | 'ready' | 'go' | 'running' | 'photo' | 'finished'
export type RaceCueKind = 'skill' | 'late-start' | 'spurt' | 'pack' | 'duel' | 'hp-empty'
export type RacePackCue =
  | 'Blocked' | 'Overtaking' | 'Pace up' | 'Pace down' | 'Holding lead'
  /** Engine v7's field mechanics (D158). */
  | 'Spot struggle' | 'Securing lead' | 'Repositioning' | 'Saving stamina'

export interface RaceCue {
  /** Its place in the race's schedule, unique within it. */
  id: number
  kind: RaceCueKind
  runner: number
  tick: number
  startSeconds: number
  endSeconds: number
  skillId?: string
  skillEffects?: readonly RaceSkillEffectKind[]
  packKind?: RacePackCue
  /** A spurt cue: whether her HP covered her full-speed spurt when she started it. */
  fullSpurt?: boolean
  /** When each rival event of the same kind folded into this toast happened, in sim seconds; empty for most cues. */
  folded: number[]
  isPlayer: boolean
}

interface CueCandidate {
  kind: RaceCueKind
  runner: number
  tick: number
  skillId?: string
  skillEffects?: readonly RaceSkillEffectKind[]
  packKind?: RacePackCue
  fullSpurt?: boolean
  isPlayer: boolean
  priority: number
  sourceIndex: number
}

export interface ActivationSummary {
  skillId: string
  count: number
  effects: RaceSkillEffectKind[]
}

export interface RacePlaybackSnapshot {
  simSeconds: number
  stage: RacePresentationStage
  done: boolean
}

/** Turn races (engine v6+) play two turns a second at 1×. */
export const TURN_RACE_RATE = 2
/** The race feed shows at most this many toasts at once, newest on top; rival activity shares one of them. */
export const RACE_FEED_SLOTS = 3
/** How long a toast stays, in seconds at 1×: a skill carries two names, so it stays a little longer. */
const cueWallSeconds = (kind: RaceCueKind) => kind === 'skill' ? 2 : 1.6

function packCue(event: RaceEvent): RacePackCue | null {
  if (event.type === 'blocked' && event.value === 1) return 'Blocked'
  if (event.type === 'overtake' && event.value === 1) return 'Overtaking'
  if (event.type === 'spot-struggle' && event.value === 1) return 'Spot struggle'
  if (event.type === 'compete') return event.value === 1 ? 'Securing lead' : 'Repositioning'
  if (event.type === 'stamina-keep') return 'Saving stamina'
  if (event.type !== 'position-mode' || !event.positionMode || event.positionMode === 'normal') return null
  if (event.positionMode === 'pace-down') return 'Pace down'
  if (event.positionMode === 'front-speed-up') return 'Holding lead'
  return 'Pace up'
}

/**
 * The race feed's schedule (D178): every cue shows at its own moment, never queued behind another, so a toast always
 * matches what is on the course. Player moments always show; when the feed is full the rival toast, else the oldest,
 * gives way. Rivals share one toast: another rival event of the same kind folds into it as "+N", and a different
 * kind waits for nobody and is dropped.
 */
export function buildRaceCues(timeline: RaceTimeline, playerIndex: number): RaceCue[] {
  const candidates: CueCandidate[] = []
  const lastPlayerPack = new Map<RacePackCue, number>()

  timeline.events.forEach((event, sourceIndex) => {
    const isPlayer = event.runner === playerIndex
    if (event.type === 'skill-activated' && event.skillId) {
      candidates.push({
        kind: 'skill', runner: event.runner, tick: event.tick, skillId: event.skillId,
        skillEffects: [...(event.skillEffects ?? [])], isPlayer, priority: isPlayer ? 0 : 4, sourceIndex,
      })
      return
    }
    if (event.type === 'late-start') {
      candidates.push({ kind: 'late-start', runner: event.runner, tick: event.tick, isPlayer, priority: isPlayer ? 1 : 3, sourceIndex })
      return
    }
    // Engine v5 duels: the cue names the rival, so it carries her index as its runner.
    if (isPlayer && event.type === 'duel' && event.value === 1 && event.targetRunner !== undefined) {
      candidates.push({ kind: 'duel', runner: event.targetRunner, tick: event.tick, isPlayer: true, priority: 1, sourceIndex })
      return
    }
    if (isPlayer && event.type === 'spurt') {
      candidates.push({
        kind: 'spurt', runner: event.runner, tick: event.tick, fullSpurt: spurtWasFull(timeline, event), isPlayer: true,
        priority: 1, sourceIndex,
      })
      return
    }
    if (isPlayer && event.type === 'hp-empty') {
      candidates.push({ kind: 'hp-empty', runner: event.runner, tick: event.tick, isPlayer: true, priority: 1, sourceIndex })
      return
    }
    if (isPlayer) {
      const kind = packCue(event)
      const seconds = event.tick / timeline.tickRate
      // Pushes before the spurt come every few seconds; one cue a stretch is enough.
      const quiet = kind === 'Repositioning' || kind === 'Securing lead' ? 10 : 3
      if (!kind || seconds - (lastPlayerPack.get(kind) ?? -Infinity) < quiet) return
      lastPlayerPack.set(kind, seconds)
      candidates.push({ kind: 'pack', runner: event.runner, tick: event.tick, packKind: kind, isPlayer: true, priority: 2, sourceIndex })
    }
  })
  candidates.sort((left, right) =>
    left.tick - right.tick || left.priority - right.priority || left.runner - right.runner || left.sourceIndex - right.sourceIndex)

  const rate = timeline.tickRate === 1 ? TURN_RACE_RATE : 1
  const schedule: RaceCue[] = []
  for (const candidate of candidates) {
    const startSeconds = candidate.tick / timeline.tickRate
    const live = schedule.filter((cue) => cue.endSeconds > startSeconds)
    const rival = live.find((cue) => !cue.isPlayer)
    if (!candidate.isPlayer) {
      if (rival) {
        if (rival.kind === candidate.kind) rival.folded.push(startSeconds)
        continue
      }
      if (live.length >= RACE_FEED_SLOTS) continue
    } else if (live.length >= RACE_FEED_SLOTS) {
      (rival ?? live[0]!).endSeconds = startSeconds
    }
    const { priority: _priority, sourceIndex: _sourceIndex, ...cue } = candidate
    schedule.push({
      ...cue,
      id: schedule.length,
      startSeconds,
      endSeconds: startSeconds + cueWallSeconds(candidate.kind) * rate,
      folded: [],
    })
  }
  return schedule
}

/** The toasts showing at `seconds`, newest first; a pure function of playback time, so pause and seek always agree. */
export function liveRaceCues(cues: readonly RaceCue[], seconds: number): RaceCue[] {
  return cues
    .filter((cue) => seconds >= cue.startSeconds && seconds < cue.endSeconds)
    .sort((left, right) => right.startSeconds - left.startSeconds)
}

export function presentationStageAt(elapsed: number, reducedMotion: boolean): RacePresentationStage {
  if (reducedMotion) {
    if (elapsed < 0.2) return 'field'
    if (elapsed < 0.4) return 'ready'
    if (elapsed < REDUCED_PRE_ROLL_SECONDS) return 'go'
    return 'running'
  }
  if (elapsed < 0.8) return 'field'
  if (elapsed < 1.5) return 'staged'
  if (elapsed < 2) return 'ready'
  if (elapsed < PRE_ROLL_SECONDS) return 'go'
  return 'running'
}

/** Pure two-clock controller used by Pixi playback and unit tests. */
export class RacePlaybackClock {
  private preRollElapsed = 0
  private simSecondsValue = 0
  private holdElapsed = 0
  private doneValue = false

  constructor(
    private readonly duration: number,
    private readonly closeFinish: boolean,
    private readonly reducedMotion: boolean,
  ) {}

  snapshot(): RacePlaybackSnapshot {
    const preRoll = this.reducedMotion ? REDUCED_PRE_ROLL_SECONDS : PRE_ROLL_SECONDS
    const stage = this.preRollElapsed < preRoll
      ? presentationStageAt(this.preRollElapsed, this.reducedMotion)
      : this.simSecondsValue < this.duration ? 'running'
        : !this.doneValue ? 'photo' : 'finished'
    return { simSeconds: this.simSecondsValue, stage, done: this.doneValue }
  }

  advance(deltaSeconds: number, speed: number): RacePlaybackSnapshot {
    let remaining = Math.max(0, deltaSeconds)
    const preRoll = this.reducedMotion ? REDUCED_PRE_ROLL_SECONDS : PRE_ROLL_SECONDS
    if (this.preRollElapsed < preRoll) {
      const consumed = Math.min(remaining, preRoll - this.preRollElapsed)
      this.preRollElapsed += consumed
      remaining -= consumed
    }

    const playbackSpeed = Math.max(0, speed)
    if (this.preRollElapsed >= preRoll && this.simSecondsValue < this.duration && remaining > 0 && playbackSpeed > 0) {
      const slowStart = Math.max(0, this.duration - PHOTO_SLOW_SECONDS)
      if (!this.closeFinish || this.reducedMotion || this.simSecondsValue < slowStart) {
        const normalEnd = this.closeFinish && !this.reducedMotion ? slowStart : this.duration
        const simAvailable = normalEnd - this.simSecondsValue
        const wallNeeded = simAvailable / playbackSpeed
        const wallUsed = Math.min(remaining, wallNeeded)
        this.simSecondsValue = Math.min(normalEnd, this.simSecondsValue + wallUsed * playbackSpeed)
        remaining -= wallUsed
      }
      if (this.simSecondsValue >= slowStart && this.simSecondsValue < this.duration && remaining > 0) {
        const slowSpeed = playbackSpeed * PHOTO_SPEED
        const simAvailable = this.duration - this.simSecondsValue
        const wallNeeded = simAvailable / slowSpeed
        const wallUsed = Math.min(remaining, wallNeeded)
        this.simSecondsValue = Math.min(this.duration, this.simSecondsValue + wallUsed * slowSpeed)
        remaining -= wallUsed
      }
    }

    if (this.preRollElapsed >= preRoll && this.simSecondsValue >= this.duration && !this.doneValue) {
      if (this.closeFinish && !this.reducedMotion) {
        this.holdElapsed += remaining
        if (this.holdElapsed >= PHOTO_HOLD_SECONDS) this.doneValue = true
      } else this.doneValue = true
    }
    return this.snapshot()
  }

  skip(): RacePlaybackSnapshot {
    this.preRollElapsed = this.reducedMotion ? REDUCED_PRE_ROLL_SECONDS : PRE_ROLL_SECONDS
    this.simSecondsValue = this.duration
    this.holdElapsed = PHOTO_HOLD_SECONDS
    this.doneValue = true
    return this.snapshot()
  }

  seek(seconds: number): RacePlaybackSnapshot {
    this.preRollElapsed = this.reducedMotion ? REDUCED_PRE_ROLL_SECONDS : PRE_ROLL_SECONDS
    this.simSecondsValue = Math.max(0, Math.min(this.duration, seconds))
    this.holdElapsed = this.simSecondsValue >= this.duration ? PHOTO_HOLD_SECONDS : 0
    this.doneValue = this.simSecondsValue >= this.duration
    return this.snapshot()
  }
}

export function isPhotoFinish(timeline: RaceTimeline): boolean {
  const margin = timeline.results[1]?.marginLengths ?? 0
  return margin > 0 && margin < 0.15
}

export function coursePositionLabel(layout: RaceCourseLayout | undefined, distance: number): string | null {
  if (!layout) return null
  const corners = layout.corners
  const straights = layout.straights
  const corner = corners.find((segment) => distance >= segment.start && distance < segment.end)
  const straight = straights.find((segment) => distance >= segment.start && distance < segment.end)
  const place = corner
    ? corner === corners[corners.length - 1] ? 'Final corner' : `Corner ${corner.number}`
    : straight && straight === straights[straights.length - 1] ? 'Final straight' : straight ? 'Straight' : null
  // Engine v5 hills (M018).
  const slope = layout.slopes?.find((segment) => distance >= segment.start && distance < segment.end)
  const hill = slope ? slope.slope > 0 ? 'Uphill' : 'Downhill' : null
  return [place, hill].filter(Boolean).join(' · ') || null
}

/**
 * A spurt event was her full-speed spurt if her final plan was the maximum and this is that speed: a heal can re-plan
 * a held-back spurt up to the maximum (D158), so an earlier, slower start stays held back.
 */
function spurtWasFull(timeline: RaceTimeline, event: RaceEvent): boolean {
  const result = timeline.results.find((entry) => entry.runner === event.runner)
  return Boolean(result?.spurtMaxed && (event.value ?? 0) >= result.spurtSpeed - 1e-6)
}

/**
 * What her stamina decided (D179). Everyone's HP runs low by the line, as in the original: most of it is the distance
 * itself, and the last spurt spends the rest on speed. What stamina changes is whether that spurt could be her fastest,
 * and whether she ran dry before the line.
 */
export interface StaminaStory {
  /** When she started her (last) spurt, in sim seconds; null if she never spurted. */
  spurtSeconds: number | null
  fullSpurt: boolean
  /** When her HP ran out and how far she still had to go; null if it never did. */
  emptySeconds: number | null
  emptyMetersLeft: number | null
  /** Her HP share as she crossed the line. */
  finishHp: number
}

export function staminaStory(timeline: RaceTimeline, playerIndex: number): StaminaStory {
  const spurts = timeline.events.filter((event) => event.runner === playerIndex && event.type === 'spurt')
  const spurt = spurts[spurts.length - 1]
  const empty = timeline.events.find((event) => event.runner === playerIndex && event.type === 'hp-empty')
  const result = timeline.results.find((entry) => entry.runner === playerIndex)
  const frames = sampleTimeline(timeline, result?.finishTime ?? Number.POSITIVE_INFINITY, [])
  const emptyAt = empty ? timeline.distance[Math.min(empty.tick, timeline.ticks - 1) * timeline.runnerCount + playerIndex] : undefined
  return {
    spurtSeconds: spurt ? spurt.tick / timeline.tickRate : null,
    fullSpurt: spurt ? spurtWasFull(timeline, spurt) : false,
    emptySeconds: empty ? empty.tick / timeline.tickRate : null,
    emptyMetersLeft: emptyAt !== undefined ? Math.max(0, Math.round(timeline.courseDistance - emptyAt)) : null,
    finishHp: Math.max(0, frames[playerIndex]?.hp ?? 0),
  }
}

export function summarizePlayerActivations(timeline: RaceTimeline, playerIndex: number): ActivationSummary[] {
  const byId = new Map<string, ActivationSummary>()
  for (const event of timeline.events) {
    if (event.runner !== playerIndex || event.type !== 'skill-activated' || !event.skillId) continue
    const current = byId.get(event.skillId)
    if (!current) {
      byId.set(event.skillId, { skillId: event.skillId, count: 1, effects: [...new Set(event.skillEffects ?? [])] })
      continue
    }
    current.count += 1
    for (const effect of event.skillEffects ?? []) if (!current.effects.includes(effect)) current.effects.push(effect)
  }
  return [...byId.values()]
}
