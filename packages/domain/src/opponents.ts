// Baseline enemy Uma: identical generic stats for every NPC in a race (docs/design/racing.md#opponents-the-baseline-enemy-uma).
import { fieldForm } from './raceForm'
import { baselineStatCap } from './scenarios'
import { mapStats, type DistanceCategory, type RaceGrade, type Stats } from './types'

export const GRADE_FACTOR: Record<RaceGrade, number> = {
  debut: 0.8,
  maiden: 0.8,
  'pre-op': 0.88,
  op: 0.88,
  g3: 0.94,
  g2: 0.97,
  g1: 1.0,
}

export const NPC_PROFILE: Record<DistanceCategory, Stats> = {
  sprint: { speed: 1.0, stamina: 0.7, power: 1.0, guts: 0.8, wit: 0.85 },
  mile: { speed: 1.0, stamina: 0.8, power: 0.95, guts: 0.8, wit: 0.85 },
  medium: { speed: 1.0, stamina: 0.9, power: 0.9, guts: 0.8, wit: 0.85 },
  long: { speed: 0.95, stamina: 1.0, power: 0.85, guts: 0.85, wit: 0.85 },
}

/** Final race stats for every NPC in a race (Race Form already applied). */
export function npcRaceStats(tier: number, grade: RaceGrade, distance: DistanceCategory, umaLevel: number): Stats {
  const base = baselineStatCap(tier) * GRADE_FACTOR[grade] * fieldForm(umaLevel)
  return mapStats(NPC_PROFILE[distance], (weight) => base * weight)
}
