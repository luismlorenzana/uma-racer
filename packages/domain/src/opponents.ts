// Baseline enemy Uma: identical generic stats for every NPC in a race (docs/design/racing.md#opponents-the-baseline-enemy-uma).
import { fieldForm } from './raceForm'
import { averageCap } from './constellation'
import { mapStats, type DistanceCategory, type RaceGrade, type Stats } from './types'

/**
 * How much weaker than a G1 field each grade's field is (D138). A career climbs G3 → G2 → G1 (D137), so the grades
 * have to be a ladder: a G3 field is 15% below a G1 field, a G2 field 8%.
 */
export const GRADE_FACTOR: Record<RaceGrade, number> = {
  debut: 0.7,
  maiden: 0.7,
  'pre-op': 0.78,
  op: 0.78,
  g3: 0.85,
  g2: 0.92,
  g1: 1.0,
}

export const NPC_PROFILE: Record<DistanceCategory, Stats> = {
  sprint: { speed: 1.0, stamina: 0.7, power: 1.0, guts: 0.8, wit: 0.85 },
  mile: { speed: 1.0, stamina: 0.8, power: 0.95, guts: 0.8, wit: 0.85 },
  medium: { speed: 1.0, stamina: 0.9, power: 0.9, guts: 0.8, wit: 0.85 },
  long: { speed: 0.95, stamina: 1.0, power: 0.85, guts: 0.85, wit: 0.85 },
}

/**
 * How strong a G1 field is, as a share of the tier's average cap (D136). Calibrated with `pnpm sim:constellation` so a
 * fully trained Uma — TL10, a full tree of max-bond current-era cards, a sensible loadout — wins a G1 roughly 55–75% of
 * the time: the agreed "opponents about 10% weaker" measured in results rather than only in Race Form multipliers.
 */
export const FIELD_STRENGTH = 0.72

/** Final race stats for every NPC in a race (Race Form already applied). */
export function npcRaceStats(tier: number, grade: RaceGrade, distance: DistanceCategory, trainingLevel: number): Stats {
  const base = averageCap(tier) * FIELD_STRENGTH * GRADE_FACTOR[grade] * fieldForm(trainingLevel)
  return mapStats(NPC_PROFILE[distance], (weight) => base * weight)
}
