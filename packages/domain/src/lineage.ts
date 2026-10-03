// Lineage slots: baseline skills and aptitude upgrades from Uma templates (docs/design/skills-and-inheritance.md).

import type { SkillTemplate, UmaTemplate } from './content'
import { inspirationParent } from './inspiration'
import {
  DISTANCE_CATEGORIES,
  GRADES,
  STRATEGIES,
  SURFACES,
  type Aptitudes,
  type Grade,
} from './types'

/** Two parents, each linked to two grandparents (D123). */
export const LINEAGE_SLOT_COUNT = 6
/** Upgrades stop at A. S is never granted. */
export const MAX_UPGRADED_GRADE: Grade = 'A'

const gradeIndex = (grade: Grade): number => GRADES.indexOf(grade)
const MAX_GRADE_INDEX = gradeIndex(MAX_UPGRADED_GRADE)

export type AptitudeCategory = keyof Aptitudes
export type AptitudeKey = string

export interface AptitudeRef {
  category: AptitudeCategory
  key: string
}

/** Every individual aptitude, in display order. */
export const APTITUDE_REFS: readonly AptitudeRef[] = [
  ...SURFACES.map((key) => ({ category: 'surface' as const, key })),
  ...DISTANCE_CATEGORIES.map((key) => ({ category: 'distance' as const, key })),
  ...STRATEGIES.map((key) => ({ category: 'strategy' as const, key })),
]

const gradeOf = (aptitudes: Aptitudes, ref: AptitudeRef): Grade =>
  (aptitudes[ref.category] as Record<string, Grade>)[ref.key]!

/**
 * Steps an aptitude gains from lineage: one per filled slot grading it A or S, minus one.
 *
 * The minus one is what makes both of the design's constraints true at once with no special case — six
 * perfect slots move a base F to A, and move a base G only as far as B.
 */
export function lineageSteps(lineage: readonly Pick<UmaTemplate, 'aptitudes'>[], ref: AptitudeRef): number {
  const supporting = lineage.filter((entry) => gradeIndex(gradeOf(entry.aptitudes, ref)) <= MAX_GRADE_INDEX).length
  return Math.max(0, supporting - 1)
}

/** One aptitude after lineage, capped at A and never reduced. */
export function upgradedGrade(
  base: Grade,
  lineage: readonly Pick<UmaTemplate, 'aptitudes'>[],
  ref: AptitudeRef,
): Grade {
  // A grade already at or above the cap is left alone: lineage upgrades, and never demotes an S.
  if (gradeIndex(base) <= MAX_GRADE_INDEX) return base
  const steps = lineageSteps(lineage, ref)
  return GRADES[Math.max(MAX_GRADE_INDEX, gradeIndex(base) - steps)]!
}

/** The full aptitude set a configuration races with. */
export function lineageAptitudes(
  base: Aptitudes,
  lineage: readonly Pick<UmaTemplate, 'aptitudes'>[],
): Aptitudes {
  const result: Aptitudes = {
    surface: { ...base.surface },
    distance: { ...base.distance },
    strategy: { ...base.strategy },
  }
  for (const ref of APTITUDE_REFS) {
    const category = result[ref.category] as Record<string, Grade>
    category[ref.key] = upgradedGrade(gradeOf(base, ref), lineage, ref)
  }
  return result
}

/** Per-aptitude detail for the constellation screen: what moved, and what moved it. */
export interface AptitudeExplanation extends AptitudeRef {
  base: Grade
  result: Grade
  steps: number
  supportingTemplateIds: string[]
}

export function explainAptitudes(
  base: Aptitudes,
  lineage: readonly Pick<UmaTemplate, 'id' | 'aptitudes'>[],
): AptitudeExplanation[] {
  return APTITUDE_REFS.map((ref) => {
    const supporting = lineage.filter((entry) => gradeIndex(gradeOf(entry.aptitudes, ref)) <= MAX_GRADE_INDEX)
    return {
      ...ref,
      base: gradeOf(base, ref),
      result: upgradedGrade(gradeOf(base, ref), lineage, ref),
      steps: Math.max(0, supporting.length - 1),
      supportingTemplateIds: supporting.map((entry) => entry.id),
    }
  })
}

/**
 * Baseline golds and whites a lineage slot pays into the library. Order is stable across slots and deduplicated.
 * Each slot also passes its inherited unique (`lineageInheritedUniques`, D174).
 */
export function lineageSkillIds(lineage: readonly Pick<UmaTemplate, 'awakeningSkillIds'>[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const entry of lineage) {
    for (const skillId of entry.awakeningSkillIds) {
      if (seen.has(skillId)) continue
      seen.add(skillId)
      ids.push(skillId)
    }
  }
  return ids
}

/**
 * The inherited unique each lineage slot passes on: its own unique, in the weaker form the original game inherits
 * (the skill's `inheritedSkillId`, a separate record with its own values and SP cost). Parents and grandparents alike,
 * so Seiun Sky in any slot lends a front runner her corner acceleration (D174). Slots whose unique has no inherited
 * form in the data pass nothing.
 */
export function lineageInheritedUniques(
  lineage: readonly Pick<UmaTemplate, 'id' | 'uniqueSkillId'>[],
  skillsById: ReadonlyMap<string, Pick<SkillTemplate, 'kind' | 'inheritedSkillId'>>,
): { skillId: string; sourceId: string }[] {
  const seen = new Set<string>()
  const result: { skillId: string; sourceId: string }[] = []
  for (const entry of lineage) {
    const inherited = entry.uniqueSkillId ? skillsById.get(entry.uniqueSkillId)?.inheritedSkillId : null
    if (!inherited || seen.has(inherited) || skillsById.get(inherited)?.kind !== 'inherited-unique') continue
    seen.add(inherited)
    result.push({ skillId: inherited, sourceId: entry.id })
  }
  return result
}

export interface LineageEligibility {
  eligible: boolean
  reason: string | null
}

/** Parents are independent; the same exact grandparent outfit may mirror across sides, never within one side. */
export function lineageSlotEligibility(candidate: Pick<UmaTemplate, 'id' | 'charaId'>,
  child: Pick<UmaTemplate, 'id' | 'charaId'>, slot: string,
  held: ReadonlyMap<string, Pick<UmaTemplate, 'id' | 'charaId'>>): LineageEligibility {
  if (candidate.charaId === child.charaId) return { eligible: false, reason: "That's her" }
  for (const [otherSlot, other] of held) {
    if (otherSlot === slot || other.charaId !== candidate.charaId) continue
    if (slot.includes('-gp') && otherSlot.includes('-gp') &&
      inspirationParent(slot) !== inspirationParent(otherSlot) && candidate.id === other.id) continue
    return { eligible: false, reason: 'Only the same grandparent outfit on the opposite side may repeat' }
  }
  return { eligible: true, reason: null }
}

/**
 * Whether a template may occupy a lineage slot. The child is never eligible, and no two slots may hold the
 * same character — different outfits of one character are the same character.
 */
export function lineageEligibility(
  candidate: Pick<UmaTemplate, 'id' | 'charaId'>,
  child: Pick<UmaTemplate, 'id' | 'charaId'>,
  occupied: readonly Pick<UmaTemplate, 'id' | 'charaId'>[],
  options: { ignoreSlotTemplateId?: string } = {},
): LineageEligibility {
  if (candidate.charaId === child.charaId) return { eligible: false, reason: "That's her" }
  const clash = occupied.some(
    (entry) => entry.id !== options.ignoreSlotTemplateId && entry.charaId === candidate.charaId,
  )
  if (clash) return { eligible: false, reason: 'Already in the lineage' }
  return { eligible: true, reason: null }
}
