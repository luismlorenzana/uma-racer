// Loading a distance preset's page from the scenario before (D288): the Constellation (card set and card nodes),
// Inspiration (lineage) or Skills (loadout) of the same preset one tier down, once this page has nothing left to unlock.
import { constellationTemplate, cardNodeCap, isNodeUnlocked, unlockedNodeCount, type NodeAssignment } from './constellation'
import type { SkillTemplate, UmaTemplate } from './content'
import { INSPIRATION_GOLDS_PER_SLOT, INSPIRATION_SLOTS } from './inspiration'
import { lineageSlotEligibility } from './lineage'
import { summarizeSkillLoadout, type SkillLoadoutSource } from './race-skills'
import { scenarioAt, type ScenarioTraining, type UmaSave } from './save'
import { lineageSlotTakesAnyUma } from './scenario-buffs'

export type PresetCarryPage = 'constellation' | 'inspiration' | 'skills'

type Unit = Pick<ScenarioTraining, 'tier' | 'trainingLevel' | 'inspiration'>

/** Every card node is open: the Training (or Constellation) Levels that open nodes are all reached. */
export const constellationComplete = (run: Pick<ScenarioTraining, 'tier' | 'trainingLevel'>): boolean =>
  unlockedNodeCount(run.tier, run.trainingLevel) >= constellationTemplate(run.tier).cardNodes

/** All six lineage slots and all twelve gold moons are bought with the scenario's tokens. */
export const inspirationComplete = (run: Pick<ScenarioTraining, 'inspiration'>): boolean =>
  INSPIRATION_SLOTS.every((slot) => run.inspiration.slots.includes(slot)) &&
  new Set(run.inspiration.golds).size >= INSPIRATION_SLOTS.length * INSPIRATION_GOLDS_PER_SLOT

/** Skills draw on both, so their page waits for the constellation and Inspiration together. */
export function presetPageComplete(run: Unit, page: PresetCarryPage): boolean {
  if (page === 'constellation') return constellationComplete(run)
  if (page === 'inspiration') return inspirationComplete(run)
  return constellationComplete(run) && inspirationComplete(run)
}

const isLineage = (assignment: NodeAssignment | undefined) => assignment?.kind === 'lineage'

function hasContent(from: ScenarioTraining, page: PresetCarryPage): boolean {
  if (page === 'constellation') return from.cardSetIds.length > 0
  if (page === 'inspiration') return INSPIRATION_SLOTS.some((slot) => isLineage(from.assignments[slot]))
  return from.loadoutSkillIds.length > 0
}

/**
 * The same preset in the scenario before, when this page may load from it: a scenario below, nothing left to unlock on
 * this page, and something on that page to bring. Null hides the load button.
 */
export function presetCarrySource(uma: UmaSave, run: ScenarioTraining, page: PresetCarryPage): ScenarioTraining | null {
  if (run.tier <= 1 || !presetPageComplete(run, page)) return null
  const from = scenarioAt(uma, run.tier - 1, run.preset)
  return from && hasContent(from, page) ? from : null
}

const cardNodes = (tier: number) => constellationTemplate(tier).nodes.filter((node) => node.kind === 'card').sort((a, b) => a.order - b.order)

/**
 * The card set, and each card node filled with the card at the same relative spot of the earlier tree, so every card
 * keeps its share of a tree of any size. A card past this tree's cap hands its extra nodes to the set's card holding
 * the fewest; empty nodes stay empty. Lineage stays as it is.
 */
export function carryConstellation(from: ScenarioTraining, to: ScenarioTraining): ScenarioTraining {
  const source = cardNodes(from.tier)
  const target = cardNodes(to.tier)
  const template = constellationTemplate(to.tier)
  const cap = cardNodeCap(to.tier)
  const inSet = new Set(from.cardSetIds)
  const held = new Map<string, number>()
  const count = (id: string) => held.get(id) ?? 0
  const assignments: Record<string, NodeAssignment> = Object.fromEntries(Object.entries(to.assignments).filter(([, a]) => a.kind !== 'card'))
  const overflow: string[] = []
  target.forEach((node, index) => {
    if (!isNodeUnlocked(template, node, to.trainingLevel)) return
    const spot = source[Math.floor((index * source.length) / target.length)]
    const assignment = spot ? from.assignments[spot.id] : undefined
    if (assignment?.kind !== 'card' || !inSet.has(assignment.cardId)) return
    if (count(assignment.cardId) >= cap) { overflow.push(node.id); return }
    assignments[node.id] = { kind: 'card', cardId: assignment.cardId }
    held.set(assignment.cardId, count(assignment.cardId) + 1)
  })
  for (const nodeId of overflow) {
    const next = from.cardSetIds.filter((id) => count(id) < cap).reduce<string | null>((best, id) => best === null || count(id) < count(best) ? id : best, null)
    if (next === null) break
    assignments[nodeId] = { kind: 'card', cardId: next }
    held.set(next, count(next) + 1)
  }
  return { ...to, cardSetIds: [...from.cardSetIds], assignments }
}

export interface LineageCarryContext {
  child: Pick<UmaTemplate, 'id' | 'charaId'>
  umas: ReadonlyMap<string, Pick<UmaTemplate, 'id' | 'charaId'>>
  /** Whether the account owns this Uma; any Uma fits a Legends slot that takes one (D165). */
  owned: (templateId: string) => boolean
}

/** The six lineage slots exactly as the earlier preset holds them (empty stays empty); card nodes stay as they are. */
export function carryInspiration(from: ScenarioTraining, to: ScenarioTraining, context: LineageCarryContext): ScenarioTraining {
  const assignments: Record<string, NodeAssignment> = Object.fromEntries(Object.entries(to.assignments).filter(([, a]) => a.kind !== 'lineage'))
  const held = new Map<string, Pick<UmaTemplate, 'id' | 'charaId'>>()
  for (const slot of INSPIRATION_SLOTS) {
    const assignment = from.assignments[slot]
    if (assignment?.kind !== 'lineage') continue
    const uma = context.umas.get(assignment.templateId)
    if (!uma || (!context.owned(uma.id) && !lineageSlotTakesAnyUma(to.tier, slot))) throw new Error('A lineage Uma from that scenario is not owned')
    held.set(slot, uma)
    assignments[slot] = { kind: 'lineage', templateId: uma.id }
  }
  for (const [slot, uma] of held) {
    const issue = lineageSlotEligibility(uma, context.child, slot, held)
    if (!issue.eligible) throw new Error(issue.reason ?? 'That lineage does not fit here')
  }
  return { ...to, assignments }
}

/**
 * The earlier loadout in its order, keeping each skill this library offers while the SP lasts; the rest are skipped and
 * counted.
 */
export function carrySkillLoadout(source: SkillLoadoutSource, template: UmaTemplate, skillsById: ReadonlyMap<string, SkillTemplate>,
  ids: readonly string[]): { loadoutSkillIds: string[]; skipped: number } {
  const kept: string[] = []
  for (const id of ids) {
    if (summarizeSkillLoadout(source, template, skillsById, [...kept, id]).valid) kept.push(id)
  }
  return { loadoutSkillIds: kept, skipped: ids.length - kept.length }
}
