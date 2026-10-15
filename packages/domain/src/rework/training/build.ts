// Her one build per tier (docs/rework/03-uma-progression.md §6, docs/rework/05-training-hub.md §4–§6,
// docs/rework/06-cards-and-bonds.md §3): what a finished unlock writes, what the advance carries, and the preset edits.
// - Commit: a new node joins all four presets and takes, in each, the set's card with the fewest nodes under its cap
//   (ties to the earlier slot), or stays empty; a new Extra Stats node turns on in every preset with room; a bond adds
//   its card. The receipt names every opening and every newly bonded card (06 §7's "ever bonded").
// - The advance (T125's) keeps sets, assignments, lineage and loadouts, and fills raised Extra Stats capacity with
//   opened nodes that were off, oldest first.
// - Presets: a set takes bonded cards of an era her scenario allows, no card or character twice (D129 hands a replaced
//   card's nodes to its replacement); nodes take set cards under the per-card cap (D134); lineage picks sit in open
//   slots, from Umas she has owned, under D250's repeat rules and Legends; active Extra Stats are opened nodes up to the
//   capacity; a loadout fits her derived library and SP (D188, D196).
import { CARD_SET_SIZE } from '../../constellation'
import { INSPIRATION_SLOTS, inspirationGoldKey, type InspirationSlot } from '../../inspiration'
import { lineageSlotEligibility } from '../../lineage'
import { summarizeSkillLoadout } from '../../race-skills'
import { lineageSlotTakesAnyUma } from '../../scenario-buffs'
import { DISTANCE_CATEGORIES, type DistanceCategory } from '../../types'
import { perCardCap, treeCardNodesAt } from '../constellation/sizes'
import { cardNodeId, nodeOrder } from '../constellation/tree'
import { advanceScenario as advanceTier, type AdvanceReceipt } from '../tiers/advance'
import type { TierContent } from '../tiers/career'
import { assertNow, withUma } from '../tiers/ledger'
import { scenarioNumber, type ScenarioCatalogue } from '../tiers/map'
import { tierRefusal } from '../tiers/refusals'
import { isRefusal, type OpResult, type Preset, type ReworkState, type ScenarioAt, type UmaBuild, type UmaState } from '../types'
import { cardEraRefusal } from './bonds'
import { deriveBuild, goalsWon, trainingTemplate, type TrainingContent } from './derive'
import { extraCapacity, extraNode } from './extra'
import { dependenciesOf, isOpen } from './order'
import { LINEAGE_WHY, trainingRefusal } from './refusals'
import { goldPosition, unlockKey, unlockLabel, type Unlock } from './unlocks'

/** A preset's card set holds up to six cards (06 §3): the slots a screen draws (T139). */
export { CARD_SET_SIZE }

type Presets = UmaBuild['presets']
const mapPresets = <T>(fn: (distance: DistanceCategory) => T): Record<DistanceCategory, T> =>
  Object.fromEntries(DISTANCE_CATEGORIES.map((distance) => [distance, fn(distance)])) as Record<DistanceCategory, T>

// ---- Commit --------------------------------------------------------------------------------------------------------

export interface CommitReceipt {
  /** Every unlock written, in order. One already open is skipped and not listed. */
  readonly opened: readonly Unlock[]
  /** Card ids newly bonded, for phase 3's "ever bonded" record (06 §7). */
  readonly bonded: readonly string[]
  /** Per preset, each new node and the card it took, or null when it stayed empty. */
  readonly assigned: Readonly<Record<DistanceCategory, Readonly<Record<string, string | null>>>>
  /** Per preset, the Extra Stats nodes that turned on. */
  readonly activated: Readonly<Record<DistanceCategory, readonly string[]>>
}

/** Nodes each set card holds among the open ones. */
function nodesHeld(preset: Preset, opened: number): Map<string, number> {
  const held = new Map<string, number>()
  for (let k = 1; k <= opened; k += 1) {
    const cardId = preset.assignments[cardNodeId(k)]
    if (cardId !== undefined) held.set(cardId, (held.get(cardId) ?? 0) + 1)
  }
  return held
}

/** The set's card with the fewest nodes under its cap, ties to the earlier slot; null when every card is capped. */
export function fillCard(preset: Preset, opened: number, cap: number): string | null {
  const held = nodesHeld(preset, opened)
  let best: string | null = null
  for (const cardId of new Set(preset.cardSetIds)) {
    const count = held.get(cardId) ?? 0
    if (count < cap && (best === null || count < (held.get(best) ?? 0))) best = cardId
  }
  return best
}

const sortSlots = (slots: readonly InspirationSlot[]): InspirationSlot[] => INSPIRATION_SLOTS.filter((slot) => slots.includes(slot))
const GOLD_ORDER = INSPIRATION_SLOTS.flatMap((slot) => [inspirationGoldKey(slot, 0), inspirationGoldKey(slot, 1)])
const sortGolds = (golds: readonly string[]): string[] => GOLD_ORDER.filter((key) => golds.includes(key))

/**
 * Writes finished unlocks into her build at `at`, in order. Each must be allowed by then: its layer open and what it
 * waits on already in the build (a session's plan checked both, and its items commit in order). One already open is
 * skipped, so paying twice changes nothing.
 */
export function commitUnlocks(build: UmaBuild, at: ScenarioAt, unlocks: readonly Unlock[]): { readonly build: UmaBuild; readonly receipt: CommitReceipt } {
  const cap = perCardCap(treeCardNodesAt(scenarioNumber(at)))
  const capacity = extraCapacity(at.scenario)
  let next = build
  const opened: Unlock[] = []
  const bonded: string[] = []
  const assigned = mapPresets((): Record<string, string | null> => ({}))
  const activated = mapPresets((): string[] => [])

  for (const entry of unlocks) {
    if (isOpen(next, entry)) continue
    if (entry.layer > at.scenario) throw new RangeError(`${unlockKey(entry)} belongs to a later layer`)
    const unmet = dependenciesOf(entry).find((dep) => !isOpen(next, dep))
    if (unmet) throw new RangeError(`${unlockKey(entry)} needs ${unlockKey(unmet)} first`)

    switch (entry.kind) {
      case 'node': {
        const order = nodeOrder(entry.target)
        if (order !== next.constellationOpened + 1) throw new RangeError(`${entry.target} is not the next node`)
        const presets = mapPresets((distance) => {
          const preset = next.presets[distance]
          const cardId = fillCard(preset, next.constellationOpened, cap)
          assigned[distance][entry.target] = cardId
          const assignments = { ...preset.assignments }
          if (cardId === null) delete assignments[entry.target]
          else assignments[entry.target] = cardId
          return { ...preset, assignments }
        })
        next = { ...next, constellationOpened: order, presets }
        break
      }
      case 'slot':
        next = { ...next, inspiration: { ...next.inspiration, slots: sortSlots([...next.inspiration.slots, entry.target as InspirationSlot]) } }
        break
      case 'unique':
        next = { ...next, inspiration: { ...next.inspiration, uniques: sortSlots([...next.inspiration.uniques, entry.target as InspirationSlot]) } }
        break
      case 'gold':
        if (!goldPosition(entry.target)) throw new RangeError(`No gold position ${entry.target}`)
        next = { ...next, inspiration: { ...next.inspiration, golds: sortGolds([...next.inspiration.golds, entry.target]) } }
        break
      case 'single':
      case 'duo':
      case 'sun': {
        if (!extraNode(entry.target)) throw new RangeError(`No Extra Stats node ${entry.target}`)
        const presets = mapPresets((distance) => {
          const preset = next.presets[distance]
          if (preset.activeExtraNodes.length >= capacity) return preset
          activated[distance].push(entry.target)
          return { ...preset, activeExtraNodes: [...preset.activeExtraNodes, entry.target] }
        })
        next = { ...next, extraNodes: [...next.extraNodes, entry.target], presets }
        break
      }
      case 'bond':
        next = { ...next, bonds: [...next.bonds, entry.target] }
        bonded.push(entry.target)
        break
    }
    opened.push(entry)
  }
  return { build: next, receipt: { opened, bonded, assigned, activated } }
}

// ---- The advance ---------------------------------------------------------------------------------------------------

/**
 * The carry at the advance (03 §6), for all four presets: sets, assignments (node ids never move), lineage and
 * loadouts stay; the raised Extra Stats capacity fills with opened nodes that were off, oldest opened first.
 */
export function carryOnAdvance(build: UmaBuild, to: ScenarioAt): { readonly build: UmaBuild; readonly activated: Readonly<Record<DistanceCategory, readonly string[]>> } {
  const capacity = extraCapacity(to.scenario)
  const activated = mapPresets((): string[] => [])
  const presets = mapPresets((distance) => {
    const preset = build.presets[distance]
    const room = capacity - preset.activeExtraNodes.length
    if (room <= 0) return preset
    const added = build.extraNodes.filter((id) => !preset.activeExtraNodes.includes(id)).slice(0, room)
    activated[distance].push(...added)
    return added.length === 0 ? preset : { ...preset, activeExtraNodes: [...preset.activeExtraNodes, ...added] }
  })
  const changed = DISTANCE_CATEGORIES.some((distance) => presets[distance] !== build.presets[distance])
  return { build: changed ? { ...build, presets } : build, activated }
}

export interface TrainingAdvanceReceipt extends AdvanceReceipt {
  /** Per preset, the Extra Stats nodes the raised capacity turned on. */
  readonly activated: Readonly<Record<DistanceCategory, readonly string[]>>
}

/** `advance-scenario` (13 §6): the tier rules' advance, then the carry. Phase 3 calls this one. */
export function advanceScenario<S extends ReworkState>(
  state: S,
  input: { readonly umaId: string },
  now: number,
  env: { readonly content: TierContent; readonly catalogue?: ScenarioCatalogue },
): OpResult<TrainingAdvanceReceipt, S> {
  const advanced = advanceTier(state, input, now, env)
  if (isRefusal(advanced)) return advanced
  const uma = advanced.state.umas[input.umaId]!
  const carried = carryOnAdvance(uma.build, uma)
  return {
    state: carried.build === uma.build ? advanced.state : withUma(advanced.state, { ...uma, build: carried.build }),
    receipt: { ...advanced.receipt, activated: carried.activated },
  }
}

// ---- Preset edits --------------------------------------------------------------------------------------------------

interface PresetInput {
  readonly umaId: string
  readonly preset: DistanceCategory
}

function presetOf(state: ReworkState, input: PresetInput, now: number): { uma: UmaState; preset: Preset } | ReturnType<typeof tierRefusal> {
  assertNow(now)
  if (!DISTANCE_CATEGORIES.includes(input.preset)) throw new RangeError(`No preset ${String(input.preset)}`)
  const uma = state.umas[input.umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: input.umaId })
  return { uma, preset: uma.build.presets[input.preset] }
}

const withPreset = <S extends ReworkState>(state: S, uma: UmaState, distance: DistanceCategory, preset: Preset): S =>
  withUma(state, { ...uma, build: { ...uma.build, presets: { ...uma.build.presets, [distance]: preset } as Presets } })

export interface CardSetReceipt {
  readonly umaId: string
  readonly preset: DistanceCategory
  readonly cardSetIds: readonly string[]
  /** A replaced card → the card that took its slot and its nodes (D129). */
  readonly handedOver: Readonly<Record<string, string>>
  /** Nodes emptied because their card left the set. */
  readonly emptied: readonly string[]
}

/**
 * D129's hand-over, as today's `withCardSet` does it: a card replaced in its slot by a card new to the set hands its
 * nodes to it; a card removed outright empties its nodes.
 */
export function handOverNodes(
  before: readonly string[],
  after: readonly string[],
  assignments: Readonly<Record<string, string>>,
): { readonly assignments: Readonly<Record<string, string>>; readonly handedOver: Readonly<Record<string, string>>; readonly emptied: readonly string[] } {
  const next = new Set(after)
  const previous = new Set(before)
  const handedOver: Record<string, string> = {}
  before.forEach((id, index) => {
    const replacement = after[index]
    if (!next.has(id) && replacement !== undefined && !previous.has(replacement)) handedOver[id] = replacement
  })
  const result: Record<string, string> = {}
  const emptied: string[] = []
  for (const [nodeId, cardId] of Object.entries(assignments)) {
    if (next.has(cardId)) result[nodeId] = cardId
    else if (handedOver[cardId] !== undefined) result[nodeId] = handedOver[cardId]
    else emptied.push(nodeId)
  }
  return { assignments: result, handedOver, emptied }
}

/** `set-card-set`: up to six bonded cards of an era her scenario allows, no card or character twice (06 §3). */
export function setCardSet<S extends ReworkState>(
  state: S,
  input: PresetInput & { readonly cardSetIds: readonly string[] },
  now: number,
  env: { readonly content: Pick<TrainingContent, 'cards'> },
): OpResult<CardSetReceipt, S> {
  const found = presetOf(state, input, now)
  if (isRefusal(found)) return found
  const { uma, preset } = found
  const T = scenarioNumber(uma)
  if (input.cardSetIds.length > CARD_SET_SIZE) return trainingRefusal('set-size', { max: CARD_SET_SIZE })
  const characters = new Map<string, string>()
  const seen = new Set<string>()
  for (const cardId of input.cardSetIds) {
    if (seen.has(cardId)) return trainingRefusal('duplicate', { item: cardId, card: cardId })
    seen.add(cardId)
    if (!uma.build.bonds.includes(cardId)) return trainingRefusal('not-bonded', { card: cardId, uma: uma.outfitId })
    const card = env.content.cards.get(cardId)
    if (!card) throw new RangeError(`No card template ${cardId}`)
    if (card.era > T) return cardEraRefusal(card)
    if (characters.has(card.charaId)) return trainingRefusal('duplicate-character', { card: cardId, other: characters.get(card.charaId)! })
    characters.set(card.charaId, cardId)
  }
  const handed = handOverNodes(preset.cardSetIds, input.cardSetIds, preset.assignments)
  const next: Preset = { ...preset, cardSetIds: [...input.cardSetIds], assignments: handed.assignments }
  return {
    state: withPreset(state, uma, input.preset, next),
    receipt: { umaId: uma.outfitId, preset: input.preset, cardSetIds: next.cardSetIds, handedOver: handed.handedOver, emptied: handed.emptied },
  }
}

export interface AssignmentsReceipt {
  readonly umaId: string
  readonly preset: DistanceCategory
  readonly assignments: Readonly<Record<string, string>>
}

/** `set-assignments`: the preset's whole node → card map, on open nodes only, set cards only, each under its cap. */
export function setAssignments<S extends ReworkState>(
  state: S,
  input: PresetInput & { readonly assignments: Readonly<Record<string, string>> },
  now: number,
): OpResult<AssignmentsReceipt, S> {
  const found = presetOf(state, input, now)
  if (isRefusal(found)) return found
  const { uma, preset } = found
  const cap = perCardCap(treeCardNodesAt(scenarioNumber(uma)))
  const held = new Map<string, number>()
  const entries = Object.entries(input.assignments).sort(([a], [b]) => (nodeOrder(a) ?? 0) - (nodeOrder(b) ?? 0))
  for (const [nodeId, cardId] of entries) {
    const order = nodeOrder(nodeId)
    if (order === null || order < 1 || order > uma.build.constellationOpened) {
      return trainingRefusal('node-locked', { node: order === null ? nodeId : unlockLabel({ kind: 'node', target: nodeId }) })
    }
    if (!preset.cardSetIds.includes(cardId)) return trainingRefusal('not-in-set', { card: cardId })
    const count = (held.get(cardId) ?? 0) + 1
    if (count > cap) return trainingRefusal('node-cap', { card: cardId, cap })
    held.set(cardId, count)
  }
  const assignments = Object.fromEntries(entries)
  return { state: withPreset(state, uma, input.preset, { ...preset, assignments }), receipt: { umaId: uma.outfitId, preset: input.preset, assignments } }
}

export interface LineageReceipt {
  readonly umaId: string
  readonly preset: DistanceCategory
  readonly lineage: Readonly<Partial<Record<InspirationSlot, string>>>
}

/**
 * `set-lineage`: who sits in each open slot (05 §5). Any Uma the account owns, in any tier, never herself; parents are
 * different characters, a grandparent repeats no character on its side and the same outfit may mirror once across
 * sides (D250, today's `lineageSlotEligibility`); Legends lets the first parent slot take any Uma (D165).
 */
export function setLineage<S extends ReworkState>(
  state: S,
  input: PresetInput & { readonly lineage: Readonly<Partial<Record<InspirationSlot, string>>> },
  now: number,
  env: { readonly content: Pick<TrainingContent, 'umas'> },
): OpResult<LineageReceipt, S> {
  const found = presetOf(state, input, now)
  if (isRefusal(found)) return found
  const { uma, preset } = found
  const T = scenarioNumber(uma)
  const child = env.content.umas.get(uma.outfitId)
  if (!child) throw new RangeError(`No Uma template ${uma.outfitId}`)
  for (const slot of Object.keys(input.lineage)) {
    if (!INSPIRATION_SLOTS.includes(slot as InspirationSlot)) throw new RangeError(`No Inspiration slot ${slot}`)
  }
  const held = new Map<string, { id: string; charaId: string }>()
  const lineage: Partial<Record<InspirationSlot, string>> = {}
  for (const slot of INSPIRATION_SLOTS) {
    const candidateId = input.lineage[slot]
    if (candidateId === undefined) continue
    if (!uma.build.inspiration.slots.includes(slot)) return trainingRefusal('slot-not-open', { slot })
    const candidate = env.content.umas.get(candidateId)
    if (!candidate) throw new RangeError(`No Uma template ${candidateId}`)
    if (candidate.charaId === child.charaId) return trainingRefusal('lineage', { candidate: candidateId, slot, why: LINEAGE_WHY.herself })
    if (state.umas[candidateId] === undefined && !lineageSlotTakesAnyUma(T, slot)) {
      return trainingRefusal('lineage', { candidate: candidateId, slot, why: LINEAGE_WHY.notOwned })
    }
    if (!lineageSlotEligibility(candidate, child, slot, held).eligible) return trainingRefusal('lineage', { candidate: candidateId, slot, why: LINEAGE_WHY.repeat })
    held.set(slot, candidate)
    lineage[slot] = candidateId
  }
  return { state: withPreset(state, uma, input.preset, { ...preset, lineage }), receipt: { umaId: uma.outfitId, preset: input.preset, lineage } }
}

export interface ActiveNodesReceipt {
  readonly umaId: string
  readonly preset: DistanceCategory
  readonly activeExtraNodes: readonly string[]
}

/** `set-active-nodes`: which opened Extra Stats nodes pay in this preset, up to the scenario's capacity (05 §6). */
export function setActiveNodes<S extends ReworkState>(
  state: S,
  input: PresetInput & { readonly nodeIds: readonly string[] },
  now: number,
): OpResult<ActiveNodesReceipt, S> {
  const found = presetOf(state, input, now)
  if (isRefusal(found)) return found
  const { uma, preset } = found
  const seen = new Set<string>()
  for (const id of input.nodeIds) {
    const node = extraNode(id)
    if (seen.has(id)) return trainingRefusal('duplicate', { item: node ? unlockLabel({ kind: node.kind, target: id }) : id })
    seen.add(id)
    if (!node || !uma.build.extraNodes.includes(id)) return trainingRefusal('node-locked', { node: node ? unlockLabel({ kind: node.kind, target: id }) : id })
  }
  const capacity = extraCapacity(uma.scenario)
  if (seen.size > capacity) return trainingRefusal('over-capacity', { capacity })
  const activeExtraNodes = uma.build.extraNodes.filter((id) => seen.has(id))
  return {
    state: withPreset(state, uma, input.preset, { ...preset, activeExtraNodes }),
    receipt: { umaId: uma.outfitId, preset: input.preset, activeExtraNodes },
  }
}

/** A loadout priced as `set-loadout` prices it (D188, D250's 2×), for the Skills tab's SP line (T138). */
export interface LoadoutSummary {
  /** SP the loadout costs, each learned skill once. Her unique costs nothing. */
  readonly cost: number
  /** Her SP in this preset. */
  readonly skillPoints: number
  /** Each equipped skill but her unique, in equip order, with what it adds to the cost. */
  readonly entries: readonly { readonly skillId: string; readonly cost: number }[]
  /** Library skills that can't be equipped (no SP price, or race mechanics not built yet), so no Equip shows. */
  readonly unequippable: readonly string[]
}

/**
 * Her loadout in `preset` at what it costs against her SP: the equipped one, or `skillIds` (her unique left out, as
 * `set-loadout` takes them) to price a change before it is made. Pure: `set-loadout` stays the rule that refuses.
 */
export function loadoutSummary(uma: UmaState, preset: DistanceCategory, content: TrainingContent, skillIds?: readonly string[]): LoadoutSummary {
  const template = trainingTemplate(content, uma.outfitId)
  const derived = deriveBuild({ at: uma, build: uma.build, preset, template, content, goalsWon: goalsWon(uma) })
  const source = { library: derived.library, skillPoints: derived.skillPoints, loadoutSkillIds: derived.loadoutSkillIds, skillCostMultipliers: derived.skillCostMultipliers }
  const ids = (skillIds ?? derived.loadoutSkillIds).filter((id) => id !== template.uniqueSkillId)
  const summary = summarizeSkillLoadout(source, template, content.skills, ids)
  const unequippable = derived.library.map((skill) => skill.skillId)
    .filter((id) => id !== template.uniqueSkillId && summarizeSkillLoadout(source, template, content.skills, [id]).entries.length === 0)
  return {
    cost: summary.cost,
    skillPoints: derived.skillPoints,
    entries: summary.entries.map((entry) => ({ skillId: entry.skill.id, cost: entry.cost })),
    unequippable,
  }
}

export interface LoadoutReceipt {
  readonly umaId: string
  readonly preset: DistanceCategory
  /** Her unique first, then the equipped skills in equip order. */
  readonly loadoutSkillIds: readonly string[]
  readonly cost: number
  readonly skillPoints: number
}

/**
 * `set-loadout`: equipped skills from the preset's derived library, priced as today (D188, D250's 2×). A loadout over
 * her SP is refused, unless it costs no more than the one it replaces (D196), so skills can always come off. Her own
 * unique is always equipped and costs nothing.
 */
export function setLoadout<S extends ReworkState>(
  state: S,
  input: PresetInput & { readonly skillIds: readonly string[] },
  now: number,
  env: { readonly content: TrainingContent },
): OpResult<LoadoutReceipt, S> {
  const found = presetOf(state, input, now)
  if (isRefusal(found)) return found
  const { uma, preset } = found
  const template = trainingTemplate(env.content, uma.outfitId)
  const derived = deriveBuild({ at: uma, build: uma.build, preset: input.preset, template, content: env.content, goalsWon: goalsWon(uma) })
  const own = (ids: readonly string[]) => ids.filter((id) => id !== template.uniqueSkillId)
  const ids = own(input.skillIds)
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return trainingRefusal('duplicate', { item: id, skill: id })
    seen.add(id)
  }
  const source = { library: derived.library, skillPoints: derived.skillPoints, loadoutSkillIds: ids, skillCostMultipliers: derived.skillCostMultipliers }
  const summary = summarizeSkillLoadout(source, template, env.content.skills, ids)
  const unavailable = ids.find((id) => !summary.entries.some((entry) => entry.skill.id === id))
  if (unavailable !== undefined) return trainingRefusal('skill-unavailable', { skill: unavailable })
  if (summary.cost > derived.skillPoints) {
    const current = summarizeSkillLoadout({ ...source, loadoutSkillIds: own(preset.loadoutSkillIds) }, template, env.content.skills)
    if (summary.cost > current.cost) return trainingRefusal('over-sp', { cost: summary.cost, sp: derived.skillPoints })
  }
  const loadoutSkillIds = template.uniqueSkillId === null ? ids : [template.uniqueSkillId, ...ids]
  return {
    state: withPreset(state, uma, input.preset, { ...preset, loadoutSkillIds }),
    receipt: { umaId: uma.outfitId, preset: input.preset, loadoutSkillIds, cost: summary.cost, skillPoints: derived.skillPoints },
  }
}
