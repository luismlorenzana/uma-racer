// Rival Umas: a typical fully trained Uma of the tier, handicapped by the race's grade
// (docs/design/racing.md#opponents-the-baseline-enemy-uma).
import { treeBudget } from './constellation'
import { STATS, mapStats, type DistanceCategory, type RaceGrade, type Stats } from './types'

/** Median base stat of the imported roster. */
export const TYPICAL_BASE_STAT = 110

/**
 * A typical fully trained Uma's average stat at a tier (D152): her base plus a fifth of a full tree of 5★ current-era
 * cards. Rivals are built on it, so they grow with the tier exactly as a trained Uma does.
 */
export const trainedStat = (tier: number): number => TYPICAL_BASE_STAT + treeBudget(tier) / STATS.length

/**
 * How much weaker than a fully trained Uma a grade's rivals race (D152). A share rather than a fixed amount, so a
 * grade is equally soft at every tier and in every stat of a build. G1 is the real test; each grade below is softer.
 */
export const GRADE_HANDICAP: Record<RaceGrade, number> = {
  debut: 0.6,
  maiden: 0.6,
  'pre-op': 0.55,
  op: 0.55,
  g3: 0.5,
  g2: 0.4,
  g1: 0.3,
}

/** How a rival spreads her stats for a distance. Each row averages 1: it shapes the build rather than shrinking it. */
export const NPC_PROFILE: Record<DistanceCategory, Stats> = {
  sprint: { speed: 1.15, stamina: 0.8, power: 1.15, guts: 0.92, wit: 0.98 },
  mile: { speed: 1.14, stamina: 0.91, power: 1.08, guts: 0.91, wit: 0.96 },
  medium: { speed: 1.12, stamina: 1.01, power: 1.01, guts: 0.9, wit: 0.96 },
  long: { speed: 1.06, stamina: 1.11, power: 0.94, guts: 0.94, wit: 0.95 },
}

/** Race stats for every rival in a race: identical for the whole field until rivals get builds of their own. */
export function npcRaceStats(tier: number, grade: RaceGrade, distance: DistanceCategory): Stats {
  const base = trainedStat(tier) * (1 - GRADE_HANDICAP[grade])
  return mapStats(NPC_PROFILE[distance], (weight) => base * weight)
}
