// Stats after the rework (docs/rework/03-uma-progression.md §8, docs/rework/06-cards-and-bonds.md §1, §4,
// docs/rework/04-tiers-and-promotion.md §8): one preset of her build at the game's scenario T, derived when read (D121).
// - Every card pays 100%: no stars, no Card Level (D329). A node pays nodeValue(T) × eraPct × the buff, split by type.
// - Card points accumulate as exact integers (share, era and buff percentages) and round once, so moving a card between
//   nodes never changes a total (D126). Growth multiplies card points only.
// - Extra Stats add flat after growth, unbuffed except by Foundation (D338). Caps clamp.
// - SP: the baseline follows her open card nodes; Friend and Group nodes pay SP with the card buff, as today (D132).
// - A filled open Inspiration slot pays aptitudes and whites; its inherited unique only once the slot's unique is open,
//   its golds only through opened positions; a single-side grandparent's cost 2× SP, a mirror normal SP (D250).
// - Race Bonus is every card's full value (06 §4), for the tier rules' `applyRaceFinish`.
// - `cardPay` is one card's share of that at a scenario, for the Card Library (06 §6, T138); a card's running-style and
//   distance focus is today's (06 §5), passed through for the Library's corners.
// - For the build views (T139): `nodeSkillIds` names what each paying node pays, and `lineagePays` what an Uma pays
//   from a slot (her golds by position and her inherited unique), the same reading the derivation itself uses.
import { MAX_STARS, cardGoldSkillIds, cardRaceBonus } from '../../cards'
export { CARD_DISTANCE_FOCI, CARD_STYLE_FOCI, cardFocus, type CardFocus } from '../../card-focus'
import { cardShares, eraPct, paysSkillPoints } from '../../constellation'
import type { SkillTemplate, SupportCardTemplate, UmaTemplate } from '../../content'
import { ownSkillIds } from '../../derived'
import { GRANDPARENT_SP_MULTIPLIER, INSPIRATION_SLOTS, inspirationGoldKey, inspirationParent, type InspirationSlot } from '../../inspiration'
import { lineageAptitudes, lineageInheritedUniques, lineageSlotEligibility } from '../../lineage'
import type { SkillUnlock } from '../../save'
import { DISTANCE_CATEGORIES, STATS, type Aptitudes, type DistanceCategory, type StatKey, type Stats, zeroStats } from '../../types'
import { fairShare, perCardCap, treeCardNodesAt } from '../constellation/sizes'
import { cardNodeId } from '../constellation/tree'
import type { PromotionPresetStats } from '../tiers/promotion'
import { capProfileAt, nodeValue, spCapAt } from '../tiers/scaling'
import { SCENARIOS_PER_TIER, scenarioNumber, scenarioPlayable, tierAndScenario } from '../tiers/map'
import type { ScenarioAt, UmaBuild, UmaState } from '../types'
import { REWORK_BUFF_VALUES as V, reworkBuff, type ReworkBuffId } from './buffs'
import { extraCapacity, extraNode, extraNodeStats, extraNodeVector } from './extra'
import { baselineSp, reworkSpNodeValue } from './skill-points'

/** The private content the derivation and the preset rules read, as phase 3's parsers deliver it. */
export interface TrainingContent {
  readonly umas: ReadonlyMap<string, UmaTemplate>
  readonly cards: ReadonlyMap<string, SupportCardTemplate>
  readonly skills: ReadonlyMap<string, SkillTemplate>
}

export interface DeriveBuildInput {
  readonly at: ScenarioAt
  readonly build: UmaBuild
  readonly preset: DistanceCategory
  /** Her own template. */
  readonly template: UmaTemplate
  readonly content: TrainingContent
  /** Career goals won in this scenario, for Climax. */
  readonly goalsWon?: number
  /** The scenario's buff; off only where a test checks the arithmetic itself. */
  readonly buffs?: boolean
}

export interface DerivedBuild {
  readonly T: number
  /** Base + card points × growth + Extra Stats, rounded once and capped: what races read. */
  readonly stats: Stats
  /** Card points per stat after the buff, before growth and caps. The invariance rule is about these. */
  readonly cardRaw: Stats
  readonly cardRawTotal: number
  /** Flat Extra Stats per stat from the preset's active nodes, Foundation included. */
  readonly extra: Stats
  readonly skillPoints: number
  readonly aptitudes: Aptitudes
  readonly library: readonly SkillUnlock[]
  /** Each library skill's cheapest SP multiplier: 2 for a single-side grandparent's golds and unique (D250). */
  readonly skillCostMultipliers: ReadonlyMap<string, number>
  /** Who pays from each filled open slot, parents first. */
  readonly lineage: Readonly<Partial<Record<InspirationSlot, UmaTemplate>>>
  /** The preset's loadout, less any skill its library no longer holds. */
  readonly loadoutSkillIds: readonly string[]
  /** The set's summed card Race Bonus at full value (0.33 = +33%), for `applyRaceFinish`. */
  readonly raceBonus: number
  /** Skills the card nodes pay, in node order. */
  readonly cardSkillIds: readonly string[]
  /**
   * What each paying node pays (D182): its card's next gold and next white, by node id, for a node's sheet (T139).
   * A node that pays nothing (empty, past its card's cap, or a card that can't pay) is absent.
   */
  readonly nodeSkillIds: Readonly<Record<string, readonly string[]>>
  readonly openNodes: number
  /** Open nodes paying: holding a bonded, era-eligible card of the set, under its cap. */
  readonly filledNodes: number
  /** The active Extra Stats that pay, oldest opened first. */
  readonly activeExtraNodes: readonly string[]
  readonly buff: ReworkBuffId | null
}

/** Card points are integers in units of 1 / SCALE: era, buff, share, the Orders share and Shared Light, each in percent. */
const SCALE = 100 ** 5
/** SP from cards: era and buff, in percent. */
const SP_SCALE = 100 ** 2
const STAT_CARD_TYPES: readonly SupportCardTemplate['type'][] = STATS

/** One preset at scenario T. Pure and total: stale ids, locked nodes and missing content pay nothing. */
export function deriveBuild(input: DeriveBuildInput): DerivedBuild {
  const { build, template, content } = input
  const T = scenarioNumber(input.at)
  const N = treeCardNodesAt(T)
  const openNodes = Math.min(build.constellationOpened, N)
  const cap = perCardCap(N)
  const preset = build.presets[input.preset]
  const buff = input.buffs === false ? null : reworkBuff(T).id

  // The cards that may pay: in the set once, bonded to her, and of an era her scenario allows (06 §3).
  const cards = new Map<string, SupportCardTemplate>()
  for (const id of preset.cardSetIds) {
    const card = content.cards.get(id)
    if (card && !cards.has(id) && build.bonds.includes(id) && card.era <= T) cards.set(id, card)
  }

  // Open nodes in unlock order; past its cap a card pays nothing (D134), so the earliest nodes stay live.
  const live: { nodeId: string; cardId: string }[] = []
  const used = new Map<string, number>()
  for (let k = 1; k <= openNodes; k += 1) {
    const nodeId = cardNodeId(k)
    const cardId = preset.assignments[nodeId]
    if (cardId === undefined || !cards.has(cardId)) continue
    const count = used.get(cardId) ?? 0
    if (count >= cap) continue
    used.set(cardId, count + 1)
    live.push({ nodeId, cardId })
  }

  // Who sits in each open slot, parents first, under D250's repeat rules.
  const held = new Map<InspirationSlot, UmaTemplate>()
  for (const slot of INSPIRATION_SLOTS) {
    const id = preset.lineage[slot]
    const entry = id === undefined ? undefined : content.umas.get(id)
    if (!entry || !build.inspiration.slots.includes(slot)) continue
    if (lineageSlotEligibility(entry, template, slot, held).eligible) held.set(slot, entry)
  }

  // The buff on one card's nodes, in whole percent (04 §8).
  const setTypes = [...cards.values()].map((card) => card.type)
  const setBonus = buff === 'team-spirit' ? held.size * V.teamSpiritPerSlot
    : buff === 'climax' ? Math.min(V.climaxGoals, Math.max(0, input.goalsWon ?? 0)) * V.climaxPerGoal
      : buff === 'performance' && STAT_CARD_TYPES.every((type) => setTypes.includes(type)) ? V.performance
        : 0
  const buffPct = (card: SupportCardTemplate): number => {
    const nodes = used.get(card.id) ?? 0
    let bonus = setBonus
    if (buff === 'fragments' && card.era <= V.fragmentsMaxEra) bonus += V.fragments
    if (buff === 'new-wave' && card.era >= V.newWaveEra) bonus += V.newWave
    if (buff === 'genres' && setTypes.filter((type) => type === card.type).length >= 2) bonus += V.genres
    if (buff === 'full-course' && nodes === cap) bonus += V.fullCourse
    if (buff === 'research' && (card.type === 'speed' || card.type === 'power')) bonus += V.research
    if (buff === 'construction' && nodes === fairShare(N)) bonus += V.construction
    if (buff === 'soak' && (card.type === 'stamina' || card.type === 'guts')) bonus += V.soak
    if (buff === 'encore' && card.type === 'wit') bonus += V.encore
    return 100 + bonus
  }

  const value = nodeValue(T)
  const spValue = reworkSpNodeValue(T)
  const scaled: Record<StatKey, number> = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  let scaledSp = 0
  const cardSkillIds: string[] = []
  const nodeSkillIds: Record<string, readonly string[]> = {}
  const cursor = new Map<string, number>()
  const golds = new Map<string, readonly string[]>()
  for (const { nodeId, cardId } of live) {
    const card = cards.get(cardId)!
    const quality = eraPct(card.era, T) * buffPct(card)
    const shares = cardShares(card)
    if (paysSkillPoints(card)) {
      scaledSp += spValue * quality
      // Orders: a Friend or Group card also pays a quarter of a node as stats, split as its type splits them.
      if (buff === 'orders') for (const stat of STATS) scaled[stat] += value * quality * (shares[stat] ?? 0) * V.ordersStatPct
    } else {
      for (const stat of STATS) scaled[stat] += value * quality * (shares[stat] ?? 0) * 100
    }
    // Each node a card fills pays its next gold and its next white (D182).
    const at = cursor.get(cardId) ?? 0
    cursor.set(cardId, at + 1)
    if (!golds.has(cardId)) golds.set(cardId, cardGoldSkillIds(card, content.skills))
    const paid = [golds.get(cardId)![at], card.hintSkillIds[at]].filter((skillId): skillId is string => Boolean(skillId))
    if (paid.length > 0) nodeSkillIds[nodeId] = paid
    for (const skillId of paid) {
      if (!cardSkillIds.includes(skillId)) cardSkillIds.push(skillId)
    }
  }

  // Shared Light: the two lowest stats from card nodes each gain +8%. Extra Stats are neither ranked nor lifted.
  const lifted = buff === 'shared-light' ? new Set([...STATS].sort((a, b) => scaled[a] - scaled[b]).slice(0, 2)) : new Set<StatKey>()
  for (const stat of STATS) scaled[stat] *= lifted.has(stat) ? 100 + V.sharedLight : 100

  const cardRaw = zeroStats()
  let total = 0
  for (const stat of STATS) {
    cardRaw[stat] = scaled[stat] / SCALE
    total += scaled[stat]
  }

  // Active Extra Stats: opened nodes the preset turned on, up to the scenario's capacity, flat after growth.
  const activeExtraNodes = [...new Set(preset.activeExtraNodes)]
    .filter((id) => build.extraNodes.includes(id) && extraNode(id) !== undefined)
    .slice(0, extraCapacity(input.at.scenario))
  const extra = zeroStats()
  for (const id of activeExtraNodes) {
    const vector = buff === null ? extraNodeVector(input.at.tier, id) : extraNodeStats(input.at.tier, T, id)
    for (const stat of STATS) extra[stat] += vector[stat]
  }

  const caps = capProfileAt(T)
  const stats = zeroStats()
  for (const stat of STATS) {
    const grown = template.baseStats[stat] + cardRaw[stat] * (1 + (template.growthRates[stat] ?? 0))
    stats[stat] = Math.min(caps[stat], Math.round(grown + extra[stat]))
  }

  const lineageList = [...held.values()]
  const { library, multipliers } = skillLibrary(T, template, build, cardSkillIds, [...cards.values()], held, content)
  const inLibrary = new Set(library.map((skill) => skill.skillId))
  return {
    T,
    stats,
    cardRaw,
    cardRawTotal: total / SCALE,
    extra,
    skillPoints: Math.min(spCapAt(T), baselineSp(T, openNodes) + Math.round(scaledSp / SP_SCALE)),
    aptitudes: lineageAptitudes(template.aptitudes, lineageList),
    library,
    skillCostMultipliers: multipliers,
    lineage: Object.fromEntries(held),
    loadoutSkillIds: preset.loadoutSkillIds.filter((id) => inLibrary.has(id)),
    raceBonus: [...cards.values()].reduce((sum, card) => sum + cardRaceBonus(card, MAX_STARS), 0),
    cardSkillIds,
    nodeSkillIds,
    openNodes,
    filledNodes: live.length,
    activeExtraNodes,
    buff,
  }
}

/**
 * Her skill library (today's `deriveUma` order): her unique, her own kit, the card nodes' skills, then each filled open
 * slot's whites, its golds through opened positions and its inherited unique once opened. Each skill keeps its cheapest
 * source: a single-side grandparent's golds and unique cost 2×, a mirror normal (D250).
 */
function skillLibrary(
  T: number,
  template: UmaTemplate,
  build: UmaBuild,
  cardSkillIds: readonly string[],
  cards: readonly SupportCardTemplate[],
  held: ReadonlyMap<InspirationSlot, UmaTemplate>,
  content: TrainingContent,
): { library: SkillUnlock[]; multipliers: Map<string, number> } {
  const library: SkillUnlock[] = []
  const multipliers = new Map<string, number>()
  const add = (skillId: string, origin: SkillUnlock['origin'], sourceId: string | null, multiplier = 1) => {
    if (!skillId) return
    const known = multipliers.get(skillId)
    if (known !== undefined && known <= multiplier) return
    multipliers.set(skillId, multiplier)
    const index = library.findIndex((skill) => skill.skillId === skillId)
    if (index >= 0) library[index] = { skillId, origin, sourceId }
    else library.push({ skillId, origin, sourceId })
  }

  if (template.uniqueSkillId) add(template.uniqueSkillId, 'own-unique', template.id)
  for (const skillId of ownSkillIds(template, T)) add(skillId, 'awakening', template.id)
  for (const skillId of cardSkillIds) {
    const owner = cards.find((card) => card.hintSkillIds.includes(skillId) || card.eventSkillIds.includes(skillId))
    add(skillId, 'card', owner?.id ?? null)
  }
  for (const [slot, entry] of held) {
    const mirrored = [...held].some(([other, uma]) => other.includes('-gp') && inspirationParent(other) !== inspirationParent(slot) && uma.id === entry.id)
    const multiplier = slot.includes('-gp') && !mirrored ? GRANDPARENT_SP_MULTIPLIER : 1
    // Whites at once; gold position k pays her k-th natural gold once opened; her inherited unique once opened.
    const pays = lineagePays(entry, content.skills)
    let goldIndex = 0
    for (const skillId of entry.awakeningSkillIds) {
      if (pays.golds[goldIndex] !== skillId) {
        add(skillId, 'inherited', entry.id, 1)
        continue
      }
      if (build.inspiration.golds.includes(inspirationGoldKey(slot, goldIndex))) add(skillId, 'inherited', entry.id, multiplier)
      goldIndex += 1
    }
    if (pays.unique !== null && build.inspiration.uniques.includes(slot)) add(pays.unique, 'inherited', entry.id, multiplier)
  }
  return { library, multipliers }
}

/** What an Uma pays from a lineage slot she fills (05 §5, D250, D174), for the derivation and the Lineage Hall's map. */
export interface LineagePay {
  /** Her natural golds in awakening order: gold position k (`<slot>:gold<k>`) pays the k-th, so gold 1 is the first. */
  readonly golds: readonly string[]
  /** Her unique in its inherited form, paid once the slot's unique is open; null when it has none. */
  readonly unique: string | null
}

/** What `template` pays from any slot: her golds by position and her inherited unique. Her whites pay at once. */
export function lineagePays(template: Pick<UmaTemplate, 'id' | 'uniqueSkillId' | 'awakeningSkillIds'>, skills: TrainingContent['skills']): LineagePay {
  return {
    golds: template.awakeningSkillIds.filter((skillId) => skills.get(skillId)?.kind === 'gold'),
    unique: lineageInheritedUniques([template], skills)[0]?.skillId ?? null,
  }
}

/** Her template; a missing one is a caller's bug (the parsers keep it out). */
export function trainingTemplate(content: TrainingContent, outfitId: string): UmaTemplate {
  const template = content.umas.get(outfitId)
  if (!template) throw new RangeError(`No Uma template ${outfitId}`)
  return template
}

/** Career goals she has won in her current scenario, for Climax. */
export const goalsWon = (uma: Pick<UmaState, 'career'>): number => uma.career.goals.filter((goal) => goal.status === 'completed').length

/** One of her presets as she stands: her scenario, her build, her template and her career's wins. */
export const deriveUmaPreset = (uma: UmaState, preset: DistanceCategory, content: TrainingContent): DerivedBuild =>
  deriveBuild({ at: { tier: uma.tier, scenario: uma.scenario }, build: uma.build, preset, template: trainingTemplate(content, uma.outfitId), content, goalsWon: goalsWon(uma) })

// ---- One card's pay, for a screen (T138) -----------------------------------------------------------------------------

/** One card at scenario T, as the Card Library shows it (06 §1, §4, §6): before her preset's buff, growth and caps. */
export interface CardPay {
  readonly T: number
  /** Whether a set at T may hold it: era ≤ T (06 §3). */
  readonly eligible: boolean
  /** `eraPct` at T (D126). */
  readonly eraPct: number
  /** The type's split of a node in whole percent, largest first (D180); empty for Friend and Group, which pay SP. */
  readonly split: readonly (readonly [StatKey, number])[]
  /** What one of its nodes pays at T, stat by stat: nodeValue(T) × eraPct × the split, unrounded; zeros for Friend and Group. */
  readonly perNode: Stats
  readonly perNodeTotal: number
  /** SP one Friend or Group node pays at T: `reworkSpNodeValue(T)` × eraPct, unrounded; 0 for the stat types (D132). */
  readonly spPerNode: number
  /** Nodes of one tree it can hold at T: the per-card cap (D134). */
  readonly nodeCap: number
  /** Its full Race Bonus (06 §4): 0.049 is +4.9% Racing EXP. */
  readonly raceBonus: number
  /** The `eraPct` it keeps in each later playable scenario of T's tier. */
  readonly later: readonly { readonly T: number; readonly eraPct: number }[]
}

/**
 * `card` at scenario T (06 §1): the node split, `eraPct`, SP per node for Friend and Group and the full Race Bonus. The
 * per-node pay is `deriveBuild`'s own arithmetic for one node with the buff off, so n of its nodes give her preset's
 * `cardRaw` before the buff; the scenario's buff is her preset's (04 §8), shown where her build is.
 */
export function cardPay(card: SupportCardTemplate, T: number): CardPay {
  const at = tierAndScenario(T)
  const pct = eraPct(card.era, T)
  const shares = cardShares(card)
  const skillPoints = paysSkillPoints(card)
  const value = nodeValue(T)
  const perNode = zeroStats()
  let perNodeTotal = 0
  if (!skillPoints) {
    // Exactly deriveBuild's units: value × eraPct × buff (100) × share × the Orders slot (100) × Shared Light's (100).
    for (const stat of STATS) {
      perNode[stat] = (value * pct * 100 * (shares[stat] ?? 0) * 100 * 100) / SCALE
      perNodeTotal += perNode[stat]
    }
  }
  const split = skillPoints ? [] : STATS.filter((stat) => (shares[stat] ?? 0) > 0)
    .map((stat) => [stat, shares[stat]!] as const)
    .sort((a, b) => b[1] - a[1] || STATS.indexOf(a[0]) - STATS.indexOf(b[0]))
  const last = SCENARIOS_PER_TIER * at.tier
  const later: { T: number; eraPct: number }[] = []
  for (let next = T + 1; next <= last && scenarioPlayable(next); next += 1) later.push({ T: next, eraPct: eraPct(card.era, next) })
  return {
    T,
    eligible: card.era <= T,
    eraPct: pct,
    split,
    perNode,
    perNodeTotal,
    spPerNode: skillPoints ? (reworkSpNodeValue(T) * pct * 100) / SP_SCALE : 0,
    nodeCap: perCardCap(treeCardNodesAt(T)),
    raceBonus: cardRaceBonus(card, MAX_STARS),
    later,
  }
}

/** One skill a card's nodes pay (D182): its k-th gold and k-th white come with the k-th node it fills. */
export interface CardNodeSkill {
  readonly skillId: string
  /** The node of hers it fills that pays it, from 1. */
  readonly node: number
  readonly gold: boolean
}

/** Every skill `card`'s nodes pay, golds first, each with its node (06 §6 "Skills"). */
export function cardNodeSkills(card: SupportCardTemplate, skills: ReadonlyMap<string, SkillTemplate>): readonly CardNodeSkill[] {
  const golds = cardGoldSkillIds(card, skills).map((skillId, i) => ({ skillId, node: i + 1, gold: true }))
  const whites = card.hintSkillIds.map((skillId, i) => ({ skillId, node: i + 1, gold: false }))
  return [...golds, ...whites]
}

/** Each preset's stats and SP as she stands, for the tier rules' `promote` and its history entry (04 §3). */
export function promotionPresetStats(uma: UmaState, content: TrainingContent): PromotionPresetStats {
  return Object.fromEntries(DISTANCE_CATEGORIES.map((distance) => {
    const derived = deriveUmaPreset(uma, distance, content)
    return [distance, { stats: derived.stats, skillPoints: derived.skillPoints }]
  })) as unknown as PromotionPresetStats
}
