// The single read path: everything an Uma is, derived from her active constellation (D121).

import { cardLimitBreak } from './card-progression'
import {
  constellationTemplate,
  deriveStats,
  isNodeUnlocked,
  type CardNodeState,
  type ConstellationTemplate,
  type DerivedStats,
} from './constellation'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { lineageAptitudes, lineageSkillIds } from './lineage'
import { activeScenario, type CardSave, type ScenarioTraining, type SkillUnlock, type UmaSave } from './save'
import type { Aptitudes, Stats } from './types'

/** One awakening skill unlocks per completed scenario, up to four. */
export const MAX_AWAKENING_SKILLS = 4

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
}

/**
 * Pure and total. Missing content, stale assignments and locked nodes all contribute nothing rather than
 * throwing, so a save can never be made unreadable by content that moved.
 */
export function deriveUma(input: DeriveUmaInput): DerivedUma {
  const scenario = activeScenario(input.uma)
  const template = constellationTemplate(scenario.tier)

  const cards = new Map<string, CardNodeState>()
  for (const cardId of scenario.cardSetIds) {
    const save = input.cardSaves.get(cardId)
    const cardTemplate = input.cardTemplates.get(cardId)
    // A card's break belongs to the scenario being derived, not to the account (D127).
    if (save && cardTemplate) {
      cards.set(cardId, { template: cardTemplate, limitBreak: cardLimitBreak(save, scenario.tier) })
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
  })

  const lineage: UmaTemplate[] = []
  for (const node of template.nodes) {
    if (node.kind !== 'parent' && node.kind !== 'grandparent') continue
    if (!isNodeUnlocked(template, node, scenario.trainingLevel)) continue
    const assignment = scenario.assignments[node.id]
    if (assignment?.kind !== 'lineage') continue
    const entry = input.umaTemplates.get(assignment.templateId)
    // Never let one Uma occupy two slots, whatever the save says.
    if (entry && !lineage.some((held) => held.charaId === entry.charaId)) lineage.push(entry)
  }

  const library: SkillUnlock[] = []
  const seen = new Set<string>()
  const add = (skillId: string, origin: SkillUnlock['origin'], sourceId: string | null) => {
    if (!skillId || seen.has(skillId)) return
    seen.add(skillId)
    library.push({ skillId, origin, sourceId })
  }

  if (input.umaTemplate.uniqueSkillId) add(input.umaTemplate.uniqueSkillId, 'own-unique', input.umaTemplate.id)
  for (const skillId of input.umaTemplate.awakeningSkillIds.slice(
    0,
    Math.min(Math.max(0, scenario.tier - 1), MAX_AWAKENING_SKILLS),
  )) add(skillId, 'awakening', input.umaTemplate.id)

  // Card-node skills carry the card that paid for them, so removing the card removes the skill.
  for (const skillId of derived.cardSkillIds) {
    const owner = scenario.cardSetIds.find((cardId) => {
      const card = cards.get(cardId)
      return card?.template.hintSkillIds.includes(skillId) ?? false
    })
    add(skillId, 'card', owner ?? null)
  }
  for (const skillId of lineageSkillIds(lineage)) {
    const owner = lineage.find((entry) => entry.awakeningSkillIds.includes(skillId))
    add(skillId, 'inherited', owner?.id ?? null)
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
    lineage,
    // A skill the configuration no longer pays for silently leaves the loadout.
    loadoutSkillIds: scenario.loadoutSkillIds.filter((id) => seen.has(id)),
    assignedNodes: derived.assignedNodes,
    filledNodes: derived.filledNodes,
  }
}
