// Deterministic race-accomplishment extraction (docs/design/badges.md §Race feats).

import type { RaceTimeline } from './types'

export interface TimelineAccomplishmentFacts {
  playerStartDelay: number
  playerFinalSpurtPlacement: number | null
  ledEverySectionCheckpoint: boolean
  inheritedUniqueActivated: boolean
}

function placementAt(timeline: RaceTimeline, tick: number, runner: number, gates: readonly number[]): number {
  const places = Array.from({ length: timeline.runnerCount }, (_, index) => ({
    runner: index,
    distance: timeline.distance[Math.min(tick, timeline.ticks - 1) * timeline.runnerCount + index] ?? 0,
    gate: gates[index] ?? index,
  })).sort((left, right) => right.distance - left.distance || left.gate - right.gate || left.runner - right.runner)
  return places.findIndex((entry) => entry.runner === runner) + 1
}

/**
 * Check the first recorded sample at every completed section boundary after the gate. A race ending before a later
 * boundary simply has no sample for that boundary; all completed samples must show an uncontested player lead.
 */
function ledEveryCompletedCheckpoint(timeline: RaceTimeline, player: number): boolean {
  const sectionLength = timeline.courseDistance / 24
  let completed = 0
  for (let section = 1; section < 24; section += 1) {
    const boundary = sectionLength * section
    let checkpoint = -1
    for (let tick = 0; tick < timeline.ticks; tick += 1) {
      const distance = timeline.distance[tick * timeline.runnerCount + player]
      if (distance !== undefined && distance >= boundary) {
        checkpoint = tick
        break
      }
    }
    if (checkpoint < 0) continue
    completed += 1
    const playerDistance = timeline.distance[checkpoint * timeline.runnerCount + player]!
    for (let runner = 0; runner < timeline.runnerCount; runner += 1) {
      if (runner === player) continue
      if ((timeline.distance[checkpoint * timeline.runnerCount + runner] ?? 0) >= playerDistance) return false
    }
  }
  return completed > 0
}

export function extractTimelineAccomplishmentFacts(input: {
  timeline: RaceTimeline
  playerIndex: number
  gates: readonly number[]
  inheritedUniqueSkillIds: ReadonlySet<string>
}): TimelineAccomplishmentFacts {
  const { timeline, playerIndex, gates, inheritedUniqueSkillIds } = input
  if (!Number.isSafeInteger(playerIndex) || playerIndex < 0 || playerIndex >= timeline.runnerCount) {
    throw new Error('Invalid accomplishment player index')
  }
  if (gates.length !== timeline.runnerCount || new Set(gates).size !== gates.length) {
    throw new Error('Invalid accomplishment gate order')
  }
  const playerResult = timeline.results.find((result) => result.runner === playerIndex)
  if (!playerResult) throw new Error('Accomplishment timeline is missing the player result')
  const spurt = timeline.events.find((event) => event.runner === playerIndex && event.type === 'spurt')
  const inheritedUniqueActivated = timeline.events.some((event) =>
    event.runner === playerIndex && event.type === 'skill-activated' && event.skillId !== undefined && inheritedUniqueSkillIds.has(event.skillId))
  return {
    playerStartDelay: playerResult.startDelay,
    playerFinalSpurtPlacement: spurt ? placementAt(timeline, spurt.tick, playerIndex, gates) : null,
    ledEverySectionCheckpoint: playerResult.placement === 1 && ledEveryCompletedCheckpoint(timeline, playerIndex),
    inheritedUniqueActivated,
  }
}
