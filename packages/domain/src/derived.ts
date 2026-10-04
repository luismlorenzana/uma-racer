// The single read path: everything an Uma is, derived from her active constellation (D121).

import { cardStars } from './card-progression'
import { cardGoldSkillIds } from './cards'
import {
  constellationTemplate,
  deriveStats,
  isNodeUnlocked,
  type CardNodeState,
  type ConstellationTemplate,
  type DerivedStats,
} from './constellation'
import type { SkillTemplate, SupportCardTemplate, UmaTemplate } from './content'
import { lineageAptitudes, lineageInheritedUniques, lineageSlotEligibility } from './lineage'
import { GRANDPARENT_SP_MULTIPLIER, inspirationGoldKey, inspirationParent } from './inspiration'
import { trainedScenario, type CardSave, type ScenarioTraining, type SkillUnlock, type UmaSave } from './save'
import type { Aptitudes, DistanceCategory, Stats } from './types'

/** An Uma's awakening skills: four, a white and a gold per pair, as in the original. */
export const MAX_AWAKENING_SKILLS = 4

/**
 * How many of her awakening skills are open in a scenario of this tier (D186): the first pair (a white and a gold) from
 * her first scenario, both pairs from her second on. Supersedes D39's one per completed scenario, which left her first
 * scenario with none of her own.
 */
export const awakeningSkillsOpen = (tier: number): number =>
  Math.max(0, Math.min(MAX_AWAKENING_SKILLS, 2 * Math.trunc(tier)))

/** Her own skills beyond her unique, in library order: open awakening skills, then innate, then her story events'. */
export function ownSkillIds(template: Pick<UmaTemplate, 'awakeningSkillIds' | 'innateSkillIds' | 'eventSkillIds'>, tier: number): string[] {
  return [
    ...template.awakeningSkillIds.slice(0, awakeningSkillsOpen(tier)),
    ...(template.innateSkillIds ?? []),
    ...(template.eventSkillIds ?? []),
  ]
}

export interface DerivedUma {
  tier: number
  trainingLevel: number
  scenario: ScenarioTraining
  template: ConstellationTemplate
  stats: Stats
  /** Pre-growth, pre-cap points. The invariance rule is about this. */
  raw: Stats
  rawTotal: number
  skillPoints: number
  aptitudes: Aptitudes
  /** Recomputed from the configuration, never stored. */
  library: SkillUnlock[]
  /** Cheapest live source; presentation and racing share this exact pricing. Not persisted. */
  skillCostMultipliers: ReadonlyMap<string, number>
  /** Templates in the six lineage slots, parents first. */
  lineage: UmaTemplate[]
  /** Loadout entries that survive the current configuration. */
  loadoutSkillIds: string[]
  assignedNodes: number
  filledNodes: number
}

export interface DeriveUmaInput {
  uma: UmaSave
  umaTemplate: UmaTemplate
  cardSaves: ReadonlyMap<string, CardSave>
  cardTemplates: ReadonlyMap<string, SupportCardTemplate>
  umaTemplates: ReadonlyMap<string, UmaTemplate>
  /** Skill records, to find each lineage slot's inherited unique (D174). */
  skillTemplates: ReadonlyMap<string, SkillTemplate>
  /** Which of her scenarios to derive (D190); the active one when omitted. */
  tier?: number
  /** Which distance preset to derive (D252); her selected one when omitted. */
  preset?: DistanceCategory
}

/**
 * Pure and total. Missing content, stale assignments and locked nodes all contribute nothing rather than
 * throwing, so a save can never be made unreadable by content that moved.
 */
export function deriveUma(input: DeriveUmaInput): DerivedUma {
  const scenario = trainedScenario(input.uma, input.tier, input.preset ?? input.uma.activePreset)
  const template = constellationTemplate(scenario.tier)

  const cards = new Map<string, CardNodeState>()
  for (const cardId of scenario.cardSetIds) {
    const save = input.cardSaves.get(cardId)
    const cardTemplate = input.cardTemplates.get(cardId)
    // A card's break belongs to the scenario being derived, not to the account (D127).
    if (save && cardTemplate) {
      cards.set(cardId, {
        template: cardTemplate,
        stars: cardStars(save, scenario.tier),
        goldSkillIds: cardGoldSkillIds(cardTemplate, input.skillTemplates),
      })
    }
  }

  const derived: DerivedStats = deriveStats({
    tier: scenario.tier,
    trainingLevel: scenario.trainingLevel,
    template,
    assignments: scenario.assignments,
    cardSetIds: scenario.cardSetIds,
    umaTemplate: input.umaTemplate,
    cards,
    extraStats: scenario.extraStats,
    inspiration: scenario.inspiration,
    // Trackblazer's Climax counts the career goals she has won in this scenario (D165).
    goalsWon: scenario.journey?.goals.filter((goal) => goal.status === 'completed').length ?? 0,
  })

  const lineage: UmaTemplate[] = []
  const lineageSlots = new Map<string, UmaTemplate>()
  // Parents take priority over an invalid conflicting grandparent in an imported/stale assignment.
  for (const node of [...template.nodes].sort((a, b) => Number(b.kind === 'parent') - Number(a.kind === 'parent'))) {
    if (node.kind !== 'parent' && node.kind !== 'grandparent') continue
    if (!isNodeUnlocked(template, node, scenario.trainingLevel, scenario.inspiration)) continue
    const assignment = scenario.assignments[node.id]
    if (assignment?.kind !== 'lineage') continue
    const entry = input.umaTemplates.get(assignment.templateId)
    if (entry && lineageSlotEligibility(entry, input.umaTemplate, node.id, lineageSlots).eligible) {
      lineage.push(entry)
      lineageSlots.set(node.id, entry)
    }
  }

  const library: SkillUnlock[] = []
  const seen = new Set<string>()
  const skillCostMultipliers = new Map<string, number>()
  const add = (skillId: string, origin: SkillUnlock['origin'], sourceId: string | null, multiplier = 1) => {
    if (!skillId) return
    const oldCost = skillCostMultipliers.get(skillId)
    if (oldCost !== undefined && oldCost <= multiplier) return
    skillCostMultipliers.set(skillId, multiplier)
    if (seen.has(skillId)) {
      const index = library.findIndex(s => s.skillId === skillId)
      library[index] = { skillId, origin, sourceId }
      return
    }
    seen.add(skillId)
    library.push({ skillId, origin, sourceId })
  }

  if (input.umaTemplate.uniqueSkillId) add(input.umaTemplate.uniqueSkillId, 'own-unique', input.umaTemplate.id)
  // Her own kit (D186): open awakening skills, innate skills and her story events' skills, all under the save's
  // existing `awakening` origin, so the save shape does not change.
  for (const skillId of ownSkillIds(input.umaTemplate, scenario.tier)) add(skillId, 'awakening', input.umaTemplate.id)

  // Card-node skills carry the card that paid for them, so removing the card removes the skill.
  for (const skillId of derived.cardSkillIds) {
    const owner = scenario.cardSetIds.find((cardId) => {
      const card = cards.get(cardId)
      return (card?.template.hintSkillIds.includes(skillId) || card?.goldSkillIds?.includes(skillId)) ?? false
    })
    add(skillId, 'card', owner ?? null)
  }
  for (const [slot, entry] of lineageSlots) {
    const mirrored = [...lineageSlots].some(([other, held]) => other.includes('-gp') &&
      inspirationParent(other) !== inspirationParent(slot) && held.id === entry.id)
    const multiplier = slot.includes('-gp') && !mirrored ? GRANDPARENT_SP_MULTIPLIER : 1
    let goldIndex = 0
    for (const skillId of entry.awakeningSkillIds) {
      const gold = input.skillTemplates.get(skillId)?.kind === 'gold'
      if (!gold || scenario.inspiration.golds.includes(inspirationGoldKey(slot, goldIndex))) {
        add(skillId, 'inherited', entry.id, gold ? multiplier : 1)
      }
      if (gold) goldIndex++
    }
    for (const { skillId, sourceId } of lineageInheritedUniques([entry], input.skillTemplates)) add(skillId, 'inherited', sourceId, multiplier)
  }

  return {
    tier: scenario.tier,
    trainingLevel: scenario.trainingLevel,
    scenario,
    template,
    stats: derived.stats,
    raw: derived.raw,
    rawTotal: derived.rawTotal,
    skillPoints: derived.skillPoints,
    aptitudes: lineageAptitudes(input.umaTemplate.aptitudes, lineage),
    library,
    skillCostMultipliers,
    lineage,
    // A skill the configuration no longer pays for silently leaves the loadout.
    loadoutSkillIds: scenario.loadoutSkillIds.filter((id) => seen.has(id)),
    assignedNodes: derived.assignedNodes,
    filledNodes: derived.filledNodes,
  }
}
