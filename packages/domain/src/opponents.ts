// Baseline enemy Uma: identical generic stats for every NPC in a race (docs/design/racing.md#opponents-the-baseline-enemy-uma).
import { fieldForm } from './raceForm'
import {
  CAREER_RACE_BONUS,
  MAX_TRAINING_LEVEL,
  averageCap,
  constellationTemplate,
  nodeValue,
  statNodeValue,
  unlockedNodeCount,
} from './constellation'
import { mapStats, type DistanceCategory, type RaceGrade, type Stats } from './types'

/**
 * The Training Level a grade's field is built at (D140): the level a career reaches that grade's stage (D137). A G3
 * field is a typical TL3 Uma, a G2 field TL6, a G1 field fully trained. Supersedes D138's flat grade factors.
 */
export const GRADE_TRAINING_LEVEL: Record<RaceGrade, number> = {
  debut: 1,
  maiden: 1,
  'pre-op': 2,
  op: 2,
  g3: 3,
  g2: 6,
  g1: 10,
}

/** Median base stat of the imported roster. */
export const TYPICAL_BASE_STAT = 110

/**
 * The share of a full TL10 build a typical Uma holds at a Training Level: five stats at her base plus the career-race
 * bonus, and every card and stat node open at that level, filled.
 */
export function fieldBuildShare(tier: number, trainingLevel: number): number {
  const template = constellationTemplate(tier)
  const held = (level: number) => {
    const open = template.nodes.filter((node) => node.order < unlockedNodeCount(tier, level))
    return 5 * (TYPICAL_BASE_STAT + CAREER_RACE_BONUS) +
      open.filter((node) => node.kind === 'card').length * nodeValue(tier) +
      open.filter((node) => node.kind === 'stat').length * statNodeValue(tier)
  }
  return held(trainingLevel) / held(MAX_TRAINING_LEVEL)
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
  const base = averageCap(tier) * FIELD_STRENGTH * fieldBuildShare(tier, GRADE_TRAINING_LEVEL[grade]) * fieldForm(trainingLevel)
  return mapStats(NPC_PROFILE[distance], (weight) => base * weight)
}
