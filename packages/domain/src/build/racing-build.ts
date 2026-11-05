// The racing build (docs/game/05-the-build.md, D382): what a race reads of her career, and the only thing the race
// hand-off reads. Stats are min(cap(T), star-5 base + Σ deck Initial stats + Σ bought pips + hint stat rewards); her
// aptitudes are her template's grades; her skills are those bought (her unique is equipped on its own). Pure.
import type { SupportCardTemplate, UmaTemplate } from '../content'
import type { BondRecord, CareerRecord, RacingBuild } from '../save/records'
import { capProfileAt } from '../tiers/scaling'
import { STATS, type Stats } from '../types'
import { statParts, type BuildView } from './derive'

/** Her stats in a career, capped. */
export function careerStats(career: CareerRecord, view: BuildView): Stats {
  const caps = capProfileAt(career.T)
  const { total } = statParts(career, view)
  return Object.fromEntries(STATS.map((stat) => [stat, Math.max(0, Math.min(caps[stat], total[stat]))])) as unknown as Stats
}

export function deriveRacingBuild(
  career: CareerRecord,
  uma: Pick<UmaTemplate, 'baseStats' | 'growthRates' | 'aptitudes'>,
  cards: ReadonlyMap<string, SupportCardTemplate>,
  bonds: Readonly<Record<string, BondRecord>>,
): RacingBuild {
  const aptitudes = {
    surface: { ...uma.aptitudes.surface },
    distance: { ...uma.aptitudes.distance },
    strategy: { ...uma.aptitudes.strategy },
  }
  return { stats: careerStats(career, { uma, cards, bonds }), aptitudes, skills: [...career.skills] }
}
