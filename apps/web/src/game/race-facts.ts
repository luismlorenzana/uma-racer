// Authoritative and legacy race-accomplishment projection (docs/design/badges.md#durable-facts-and-honest-history).

import {
  parseRaceAccomplishmentFacts,
  type RaceAccomplishmentFactsV1,
  type RaceResultRecord,
  type RaceTemplate,
} from '@racer/domain'
import {
  extractTimelineAccomplishmentFacts,
  simulateRace,
  simulateRaceV1,
  simulateRaceV2,
  simulateRaceV3,
  simulateRaceV4,
  type RaceInput,
  type RaceTimeline,
} from '@racer/race'
import type { LoadedContent } from '../content/runtime'

export function accomplishmentFactsFromTimeline(input: {
  race: RaceTemplate
  timeline: RaceTimeline
  playerIndex: number
  gates: readonly number[]
  inheritedUniqueSkillIds: ReadonlySet<string>
}): RaceAccomplishmentFactsV1 {
  const timelineFacts = extractTimelineAccomplishmentFacts(input)
  const facts: RaceAccomplishmentFactsV1 = {
    version: 1,
    familyId: input.race.familyId,
    grade: input.race.grade,
    venueKey: input.race.venueKey,
    venueTags: [...input.race.venueTags],
    courseId: input.race.courseId,
    surface: input.race.surface,
    distance: input.race.distance,
    distanceCategory: input.race.distanceCategory,
    series: [...input.race.series],
    ...timelineFacts,
  }
  const parsed = parseRaceAccomplishmentFacts(facts)
  if (!parsed) throw new Error('Race accomplishment extraction produced invalid facts')
  return parsed
}

function replayInput(content: LoadedContent, record: RaceResultRecord): { input: RaceInput; playerIndex: number } {
  const race = content.races.byId.get(record.raceId)
  if (!race) throw new Error('Legacy race content is unavailable')
  const byGate = [...record.field].sort((left, right) => left.gate - right.gate)
  const playerIndex = byGate.findIndex((runner) => runner.isPlayer)
  if (playerIndex < 0) throw new Error('Legacy race player is unavailable')
  return {
    playerIndex,
    input: {
      course: record.course ? { ...record.course } : { distance: race.distance, surface: race.surface },
      runners: byGate.map((runner) => ({
        id: runner.umaId,
        label: String(runner.gate + 1),
        stats: { ...runner.stats },
        strategy: runner.strategy,
        aptitude: { ...runner.aptitude },
        gate: runner.gate,
        ...(runner.skills ? { skills: [...runner.skills] } : {}),
      })),
      seed: record.seed,
    },
  }
}

/** Return null when one legacy replay/content dependency is missing; callers retain all independently exact facts. */
export function projectLegacyAccomplishmentFacts(content: LoadedContent, record: RaceResultRecord): RaceAccomplishmentFactsV1 | null {
  if (record.accomplishmentFacts) return record.accomplishmentFacts
  try {
    const race = content.races.byId.get(record.raceId)
    if (!race) return null
    const replay = replayInput(content, record)
    // Each record replays under the rules it was run with; v3 must not pick up v4's stamina contest, nor v4 v5's rules.
    const timeline = record.engineVersion === 5
      ? simulateRace(replay.input)
      : record.engineVersion === 4
        ? simulateRaceV4(replay.input)
      : record.engineVersion === 3
        ? simulateRaceV3(replay.input)
        : record.engineVersion === 2
          ? simulateRaceV2(replay.input)
          : simulateRaceV1(replay.input)
    const player = replay.input.runners[replay.playerIndex]!
    const inheritedUniqueSkillIds = new Set(
      (player.skills ?? [])
        .filter((skill) => skill.inherited && content.skills.byId.get(skill.id)?.kind === 'inherited-unique')
        .map((skill) => skill.id),
    )
    return accomplishmentFactsFromTimeline({
      race,
      timeline,
      playerIndex: replay.playerIndex,
      gates: replay.input.runners.map((runner) => runner.gate),
      inheritedUniqueSkillIds,
    })
  } catch {
    return null
  }
}
