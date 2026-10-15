// A synthetic race as the engine ran it, for `finish-race` and the generation-2 save's tests (T134): today's race record
// without its progression fields, on engine v9's course shape. Every id and number is invented.
import type { RaceRun } from '../progression-race'
import type { Strategy } from '../types'

const STATS = { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }

/** Her race of eight runners, where she finished `placement`, running `strategy`. */
export function raceRun(umaId: string, placement = 1, strategy: Strategy = 'pace'): RaceRun {
  const others = Array.from({ length: 8 }, (_, i) => i + 1).filter((place) => place !== placement)
  return {
    engineVersion: 9,
    course: {
      distance: 2_000, surface: 'turf', season: 1, trackId: 10006, rotation: 1, grade: 100,
      layout: { corners: [{ start: 1_200, end: 1_600, number: 2 }], straights: [{ start: 0, end: 1_200 }, { start: 1_600, end: 2_000 }], slopes: [] },
    },
    contentVersion: 'synthetic-v1',
    seed: 4242,
    strategy,
    startStats: STATS,
    field: Array.from({ length: 8 }, (_, gate) => ({
      umaId: gate === 0 ? umaId : `rival-${gate}`,
      isPlayer: gate === 0,
      strategy: gate === 0 ? strategy : 'late',
      gate,
      stats: STATS,
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' },
      placement: gate === 0 ? placement : others[gate - 1]!,
      finishTime: 120 + (gate === 0 ? placement : others[gate - 1]!),
      marginLengths: 1,
      skills: [],
    })),
    accomplishmentFacts: {
      version: 1, familyId: 'synthetic-family', grade: 'g1', venueKey: 'synthetic-venue', venueTags: [], courseId: 'synthetic-course',
      surface: 'turf', distance: 2_000, distanceCategory: 'medium', series: [], playerStartDelay: 0.04, playerFinalSpurtPlacement: placement,
      ledEverySectionCheckpoint: false, inheritedUniqueActivated: false,
    },
  }
}
