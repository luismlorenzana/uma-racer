import {
  distanceCategory,
  npcRaceStats,
  statCap,
  yourForm,
  type RaceGrade,
  type Stats,
  type Strategy,
  type Surface,
} from '@racer/domain'
import { createRng, type RaceInput } from '@racer/race'

// Demo catalog + field builder until the race catalog and stable exist. Uses the real domain rules:
// baseline enemy Umas (identical generic stats) and a fully trained tier-1 player Uma, both with Race Form applied.

export interface DemoRace {
  id: string
  name: string
  grade: RaceGrade
  venue: string
  surface: Surface
  distance: number
  fieldSize: number
}

export const DEMO_RACES: DemoRace[] = [
  { id: 'sprinters-stakes', name: 'Sprinters Stakes', grade: 'g1', venue: 'Nakayama', surface: 'turf', distance: 1200, fieldSize: 12 },
  { id: 'yasuda-kinen', name: 'Yasuda Kinen', grade: 'g1', venue: 'Tokyo', surface: 'turf', distance: 1600, fieldSize: 14 },
  { id: 'february-stakes', name: 'February Stakes', grade: 'g1', venue: 'Tokyo', surface: 'dirt', distance: 1600, fieldSize: 12 },
  { id: 'japan-cup', name: 'Japan Cup', grade: 'g1', venue: 'Tokyo', surface: 'turf', distance: 2400, fieldSize: 16 },
  { id: 'arima-kinen', name: 'Arima Kinen', grade: 'g1', venue: 'Nakayama', surface: 'turf', distance: 2500, fieldSize: 16 },
  { id: 'tenno-sho-spring', name: 'Tenno Sho (Spring)', grade: 'g1', venue: 'Kyoto', surface: 'turf', distance: 3200, fieldSize: 14 },
  { id: 'debut-mile', name: 'Make Debut', grade: 'debut', venue: 'Hanshin', surface: 'turf', distance: 1600, fieldSize: 9 },
]

export const STRATEGY_LABEL: Record<Strategy, string> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
}

export const GRADE_LABEL: Record<RaceGrade, string> = {
  debut: 'Debut',
  maiden: 'Maiden',
  'pre-op': 'Pre-OP',
  op: 'OP',
  g3: 'G3',
  g2: 'G2',
  g1: 'G1',
}

export interface DemoField {
  input: RaceInput
  playerIndex: number
}

const STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end']

export function buildDemoField(race: DemoRace, strategy: Strategy, seed: number, umaLevel = 5): DemoField {
  const rng = createRng(seed ^ 0x5bd1e995)
  const category = distanceCategory(race.distance)
  const npcStats = npcRaceStats(1, race.grade, category, umaLevel)
  const cap = statCap(1, 10)
  const form = yourForm(umaLevel)
  const playerStats: Stats = { speed: cap * form, stamina: cap * form, power: cap * form, guts: cap * form, wit: cap * form }
  const playerGate = Math.floor(rng.next() * race.fieldSize)

  const runners = Array.from({ length: race.fieldSize }, (_, gate) => {
    const isPlayer = gate === playerGate
    return {
      id: isPlayer ? 'you' : `rival-${gate + 1}`,
      label: isPlayer ? 'You' : `${gate + 1}`,
      stats: isPlayer ? playerStats : npcStats,
      strategy: isPlayer ? strategy : STRATEGIES[Math.floor(rng.next() * STRATEGIES.length)]!,
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      gate,
    }
  })

  return { input: { course: { distance: race.distance, surface: race.surface }, runners, seed }, playerIndex: playerGate }
}
