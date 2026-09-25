import type { RaceCourseLayout, RaceSkillEffectKind } from '@racer/domain'
import type { RaceEvent, RaceTimeline } from '@racer/race'

// Pure renderer choreography derived from immutable race output
// (docs/design/racing.md#presentation-straight-line-real-time-view).

export const PRE_ROLL_SECONDS = 2.4
export const REDUCED_PRE_ROLL_SECONDS = 0.6
export const PHOTO_SLOW_SECONDS = 0.8
export const PHOTO_SPEED = 0.4
export const PHOTO_HOLD_SECONDS = 0.65

export type RacePresentationStage = 'field' | 'staged' | 'ready' | 'go' | 'running' | 'photo' | 'finished'
export type RaceCueKind = 'skill' | 'late-start' | 'spurt' | 'pack' | 'duel'
export type RacePackCue = 'Blocked' | 'Overtaking' | 'Pace up' | 'Pace down' | 'Holding lead'

export interface RaceCue {
  kind: RaceCueKind
  runner: number
  tick: number
  startSeconds: number
  endSeconds: number
  skillId?: string
  skillEffects?: readonly RaceSkillEffectKind[]
  packKind?: RacePackCue
  /** Other events folded into this cue. Zero for an ungrouped cue. */
  additionalCount: number
  isPlayer: boolean
}

interface CueCandidate extends Omit<RaceCue, 'startSeconds' | 'endSeconds'> {
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

const cueDuration = (kind: RaceCueKind) => kind === 'skill' ? 1.7 : 1.25

function packCue(event: RaceEvent): RacePackCue | null {
  if (event.type === 'blocked' && event.value === 1) return 'Blocked'
  if (event.type === 'overtake' && event.value === 1) return 'Overtaking'
  if (event.type !== 'position-mode' || !event.positionMode || event.positionMode === 'normal') return null
  if (event.positionMode === 'pace-down') return 'Pace down'
  if (event.positionMode === 'front-speed-up') return 'Holding lead'
  return 'Pace up'
}

/** Creates a stable, serialized cue schedule; noisy rival/pack cues yield to player moments. */
export function buildRaceCues(timeline: RaceTimeline, playerIndex: number): RaceCue[] {
  const candidates: CueCandidate[] = []
  const rivalSkills = new Map<number, CueCandidate>()
  let rivalLate: CueCandidate | null = null
  const lastPlayerPack = new Map<RacePackCue, number>()

  timeline.events.forEach((event, sourceIndex) => {
    const isPlayer = event.runner === playerIndex
    if (event.type === 'skill-activated' && event.skillId) {
      const candidate: CueCandidate = {
        kind: 'skill',
        runner: event.runner,
        tick: event.tick,
        skillId: event.skillId,
        skillEffects: [...(event.skillEffects ?? [])],
        additionalCount: 0,
        isPlayer,
        priority: isPlayer ? 0 : 4,
        sourceIndex,
      }
      if (isPlayer) candidates.push(candidate)
      else {
        const halfSecondTicks = Math.max(1, Math.round(timeline.tickRate / 2))
        const bucket = Math.floor(event.tick / halfSecondTicks)
        const grouped = rivalSkills.get(bucket)
        if (grouped && candidate.runner < grouped.runner) {
          candidate.additionalCount = grouped.additionalCount + 1
          rivalSkills.set(bucket, candidate)
        } else if (grouped) grouped.additionalCount += 1
        else rivalSkills.set(bucket, candidate)
      }
      return
    }

    if (event.type === 'late-start') {
      const candidate: CueCandidate = {
        kind: 'late-start', runner: event.runner, tick: event.tick, additionalCount: 0, isPlayer,
        priority: isPlayer ? 1 : 4, sourceIndex,
      }
      if (isPlayer) candidates.push(candidate)
      else if (rivalLate) rivalLate.additionalCount += 1
      else rivalLate = candidate
      return
    }

    // Engine v5 duels: the cue names the rival, so it carries her index as its runner.
    if (isPlayer && event.type === 'duel' && event.value === 1 && event.targetRunner !== undefined) {
      candidates.push({
        kind: 'duel', runner: event.targetRunner, tick: event.tick, additionalCount: 0, isPlayer: true,
        priority: 1, sourceIndex,
      })
      return
    }

    if (isPlayer && event.type === 'spurt') {
      candidates.push({
        kind: 'spurt', runner: event.runner, tick: event.tick, additionalCount: 0, isPlayer: true,
        priority: 1, sourceIndex,
      })
      return
    }

    if (isPlayer) {
      const kind = packCue(event)
      const seconds = event.tick / timeline.tickRate
      if (!kind || seconds - (lastPlayerPack.get(kind) ?? -Infinity) < 3) return
      lastPlayerPack.set(kind, seconds)
      candidates.push({
        kind: 'pack', runner: event.runner, tick: event.tick, packKind: kind, additionalCount: 0, isPlayer: true,
        priority: 3, sourceIndex,
      })
    }
  })

  candidates.push(...rivalSkills.values())
  if (rivalLate) candidates.push(rivalLate)
  candidates.sort((left, right) =>
    left.tick - right.tick || left.priority - right.priority || left.runner - right.runner || left.sourceIndex - right.sourceIndex)

  const schedule: RaceCue[] = []
  let nextAvailable = 0
  for (const candidate of candidates) {
    const sourceSeconds = candidate.tick / timeline.tickRate
    const startSeconds = Math.max(sourceSeconds, nextAvailable)
    const protectedPlayerCue = candidate.isPlayer && candidate.kind !== 'pack'
    if (!protectedPlayerCue && startSeconds - sourceSeconds > 2.5) continue
    const endSeconds = startSeconds + cueDuration(candidate.kind)
    const { priority: _priority, sourceIndex: _sourceIndex, ...cue } = candidate
    schedule.push({ ...cue, startSeconds, endSeconds })
    nextAvailable = endSeconds
  }
  return schedule
}

export function activeRaceCue(cues: readonly RaceCue[], seconds: number): RaceCue | null {
  return cues.find((cue) => seconds >= cue.startSeconds && seconds < cue.endSeconds) ?? null
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
