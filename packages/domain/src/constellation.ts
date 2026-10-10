// Per-scenario skill trees: budgets, node values, and derived stats (docs/design/constellations.md).

import { MAX_STARS } from './cards'
import { BUFF_VALUES, scenarioBuff } from './scenario-buffs'
import { SHAPE_ART, cellKey, parseShapeArt, type ShapeCell } from './constellation-shapes'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { MAX_SCENARIO_TIER, SCENARIOS, baselineSkillPoints, skillPointCap } from './scenarios'
import { STATS, type StatKey, type Stats, zeroStats } from './types'
import { farmCropById } from './farm/catalog'
import type { FarmCropId } from './farm/types'
import { EXTRA_STAT_NODE_VALUE, EXTRA_STAT_SLOTS, extraStatCounts, type ExtraStats } from './extra-stats'

export const MAX_TRAINING_LEVEL = 10
/** Training Levels 1–8 open card nodes; 9 and 10 open lineage (docs/design/constellations.md, D235). */
export const NODE_UNLOCK_LEVELS = 8
export const CARD_SET_SIZE = 6
/**
 * Raw points the six active Extra stat nodes pay between them (D134, D235). Small on purpose: they are for tweaks — the
 * stamina a mile needs, one more point of Speed — and cards carry the build.
 */
export const HISTORICAL_CARD_NORMALIZATION = 240
/** Legacy pool name retained for old saves/sims; new Farm capacity never changes card pricing. */
export const STAT_NODE_POOL = HISTORICAL_CARD_NORMALIZATION
/** A max-bonded Friend or Group card on its fair share of nodes pays this share of the SP cap (D133). */
export const SP_CARD_SHARE = 0.6
/** A full constellation pays this share of the scenario's cap budget, so no build reaches every cap. */
export const TREE_BUDGET_SHARE = 0.6

/**
 * Per-stat caps. URA Finale caps every stat at 1200 (6000); each later scenario adds 250: 100 to Speed, 100 to a main
 * stat and 50 to a sub stat, round-robin through Stamina, Power, Guts and Wit. Each row sums to that scenario's cap budget.
 */
export const CAP_PROFILES: readonly Stats[] = [
  { speed: 1200, stamina: 1200, power: 1200, guts: 1200, wit: 1200 }, // 1  URA Finale
  { speed: 1300, stamina: 1300, power: 1250, guts: 1200, wit: 1200 }, // 2  Unity Cup
  { speed: 1400, stamina: 1300, power: 1350, guts: 1250, wit: 1200 }, // 3  Trackblazer
  { speed: 1500, stamina: 1300, power: 1350, guts: 1350, wit: 1250 }, // 4  Our Grand Concert
  { speed: 1600, stamina: 1350, power: 1350, guts: 1350, wit: 1350 }, // 5  Grand Masters
  { speed: 1700, stamina: 1450, power: 1400, guts: 1350, wit: 1350 }, // 6  Project L'Arc
  { speed: 1800, stamina: 1450, power: 1500, guts: 1400, wit: 1350 }, // 7  U.A.F. Ready GO!
  { speed: 1900, stamina: 1450, power: 1500, guts: 1500, wit: 1400 }, // 8  Great Food Festival
  { speed: 2000, stamina: 1500, power: 1500, guts: 1500, wit: 1500 }, // 9  Run! Mecha Umamusume
  { speed: 2100, stamina: 1600, power: 1550, guts: 1500, wit: 1500 }, // 10 The Twinkle Legends
  { speed: 2200, stamina: 1600, power: 1650, guts: 1550, wit: 1500 }, // 11 Design Your Island
  { speed: 2300, stamina: 1600, power: 1650, guts: 1650, wit: 1550 }, // 12 Yukoma Hot Springs
  { speed: 2400, stamina: 1650, power: 1650, guts: 1650, wit: 1650 }, // 13 Beyond Dreams
  { speed: 2500, stamina: 1750, power: 1700, guts: 1650, wit: 1650 }, // 14 Tracen Diner
]

export interface ShapeDef {
  shape: string
  cardNodes: number
}

/**
 * The silhouettes are drawn with six tips past the card nodes: the Produce nodes before D235. Building a tree prunes
 * them, so the card nodes keep their ids and places, and the ids the tips had are only read by the v11 migration.
 */
export const DRAWN_TIPS = 6

/** Slot counts and silhouettes per scenario (docs/design/scenarios.md#constellation-shapes). */
export const CONSTELLATION_SHAPES: readonly ShapeDef[] = [
  { shape: 'single-trunk', cardNodes: 18 },
  { shape: 'three-branch', cardNodes: 20 },
  { shape: 'track-spurs', cardNodes: 17 },
  { shape: 'five-arm-star', cardNodes: 21 },
  { shape: 'twin-arcs', cardNodes: 25 },
  { shape: 'arch', cardNodes: 26 },
  { shape: 'three-colour', cardNodes: 27 },
  { shape: 'canopy', cardNodes: 27 },
  { shape: 'lattice-spine', cardNodes: 28 },
  { shape: 'crown', cardNodes: 29 },
  { shape: 'island-ring', cardNodes: 30 },
  { shape: 'spiral', cardNodes: 30 },
  { shape: 'twin-trunks', cardNodes: 31 },
  { shape: 'counter', cardNodes: 32 },
]

const clampTier = (tier: number): number => Math.min(MAX_SCENARIO_TIER, Math.max(1, Math.trunc(tier)))

export const capProfile = (tier: number): Stats => CAP_PROFILES[clampTier(tier) - 1]!

export const capBudget = (tier: number): number =>
  STATS.reduce((sum, stat) => sum + capProfile(tier)[stat], 0)

/** One scalar for "how strong is this tier", used to scale opponents. The cap profile's mean (D119). */
export const averageCap = (tier: number): number => capBudget(tier) / STATS.length

export const shapeDef = (tier: number): ShapeDef => CONSTELLATION_SHAPES[clampTier(tier) - 1]!


/** The tree's nodes that Training Levels 1–8 open: its card nodes (D235). */
export const slotCount = (tier: number): number => shapeDef(tier).cardNodes

/**
 * Raw points one **card** node pays at max stars and current era: what is left of the tree's share of the cap budget
 * once the Extra stat pool is set aside, over the card nodes (D134). Rounded to an integer so the invariance rule can
 * be asserted exactly rather than within a tolerance.
 */
export const nodeValue = (tier: number): number =>
  Math.round((TREE_BUDGET_SHARE * capBudget(tier) - HISTORICAL_CARD_NORMALIZATION) / shapeDef(tier).cardNodes)

/** Total raw points a fully-filled constellation of current-era, maxed stat cards and six Extra stats pays. */
export const treeBudget = (tier: number): number => shapeDef(tier).cardNodes * nodeValue(tier) + STAT_NODE_POOL

/** The nodes one card of six gets if the tree is shared out evenly, rounded up (D134). */
export const cardFairShare = (tier: number): number => Math.ceil(shapeDef(tier).cardNodes / CARD_SET_SIZE)

/**
 * The most card nodes any one card may fill: its fair share plus one (D134). One Speed card cannot carry a Speed
 * build, and the +1 leaves room to lean a set one node towards Speed or Wit for a given race.
 */
export const cardNodeCap = (tier: number): number => cardFairShare(tier) + 1

/** SP one node of a max-bonded, current-era Friend or Group card pays (D133). An integer at every tier. */
export const spNodeValue = (tier: number): number => Math.round((SP_CARD_SHARE * skillPointCap(tier)) / cardFairShare(tier))

// --- Cards -------------------------------------------------------------------------------------

export type CardNodeType = StatKey | 'friend' | 'group'

/**
 * How a card node splits its value, in integer percentage points so the arithmetic stays exact: the main stat 70 and
 * the stat its facility also trains in the original 30, Guts 60 with Speed and Power 20 each. Every card of a type
 * pays the same split (D180). Every row sums to 100, which is what makes the invariance rule hold whatever you slot.
 */
export const CARD_TYPE_SHARES: Record<CardNodeType, Partial<Record<StatKey, number>>> = {
  speed: { speed: 70, power: 30 },
  stamina: { stamina: 70, guts: 30 },
  power: { power: 70, stamina: 30 },
  guts: { guts: 60, speed: 20, power: 20 },
  wit: { wit: 70, speed: 30 },
  friend: { speed: 20, stamina: 20, power: 20, guts: 20, wit: 20 },
  group: { speed: 20, stamina: 20, power: 20, guts: 20, wit: 20 },
}

/** Percentage of a node's value a card pays at 0★–3★ (D200): the old 0★ · 1★ · 3★ · 5★ of D147's curve. */
export const STAR_NODE_PCT = [60, 68, 84, 100] as const

export const starNodePct = (stars: number): number =>
  STAR_NODE_PCT[Math.min(MAX_STARS, Math.max(0, Math.trunc(stars)))]!

/** Percentage points a card loses for each scenario it predates. */
export const ERA_PENALTY_PER_STEP = 5
/** However old a card is, it never falls below this share of a node. */
export const MIN_ERA_PCT = 40

/**
 * Percentage of a node's value a card pays for its age, relative to the scenario it is used in (D126).
 *
 * A card from the scenario's own era is full value; every era it predates costs 5 points, floored at 40.
 * Keying this to the scenario rather than to an absolute era is what keeps `treeBudget` the real ceiling
 * at every tier, while still making a newer card strictly better than an older one beside it.
 */
export const eraPct = (cardEra: number, tier: number): number =>
  Math.max(MIN_ERA_PCT, 100 - ERA_PENALTY_PER_STEP * Math.max(0, Math.trunc(tier) - Math.trunc(cardEra)))

/** How one node of this card splits, stat by stat: its type's shares (D180). */
export function cardShares(template: Pick<SupportCardTemplate, 'type'>): Partial<Record<StatKey, number>> {
  return { ...(CARD_TYPE_SHARES[template.type as CardNodeType] ?? CARD_TYPE_SHARES.speed) }
}

// --- Templates ---------------------------------------------------------------------------------

export const NODE_KINDS = ['root', 'card', 'parent', 'grandparent'] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export interface ConstellationNode {
  id: string
  kind: NodeKind
  /** Graph edge toward the root, or toward the owning parent node for a grandparent. */
  parentId: string | null
  /** Layout position in a 0–100 square. Authored, never simulated. */
  x: number
  y: number
  /** Unlock order among card nodes; lineage nodes use their fixed Training Level instead. */
  order: number
}

export interface ConstellationTemplate {
  tier: number
  scenarioId: string
  shape: string
  cardNodes: number
  nodes: ConstellationNode[]
}

export const ROOT_NODE_ID = 'root'

/** The card tree's band; lineage sits below it, visually detached (D123). */
export const TREE_BOX = { minX: 2, maxX: 98, minY: 2, maxY: 74 } as const
export const LINEAGE_BAND = { parentY: 83, grandparentY: 94 } as const

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * Builds a scenario's tree from its silhouette (`SHAPE_ART`). Each grid cell becomes a position in `TREE_BOX`, so a
 * sparse shape spreads out and a dense one packs in. Nodes are numbered breadth-first from the root, nearer rows and
 * then columns first: the number is the unlock order, so the tree opens outward. The last `DRAWN_TIPS` reached were the
 * Produce nodes until D235 and are pruned; being last breadth-first, nothing hangs off them. Ids and order are therefore
 * fixed by the counts alone, and a redrawn silhouette never moves a saved assignment to a different node.
 */
export function buildTemplate(tier: number): ConstellationTemplate {
  const t = clampTier(tier)
  const def = shapeDef(t)
  const scenario = SCENARIOS[t - 1]!
  const grid = parseShapeArt(SHAPE_ART[t - 1]!)
  const total = def.cardNodes + DRAWN_TIPS
  if (grid.cells.length !== total) throw new Error(`tier ${t} draws ${grid.cells.length} nodes, expected ${total}`)
  const links = [...grid.links.values()].reduce((sum, neighbours) => sum + neighbours.length, 0) / 2
  if (links !== total) throw new Error(`tier ${t} draws ${links} connectors for ${total} nodes; a tree needs one per node`)

  const pitchX = (TREE_BOX.maxX - TREE_BOX.minX) / grid.columns
  const pitchY = (TREE_BOX.maxY - TREE_BOX.minY) / grid.rows
  const place = (cell: ShapeCell) => ({
    x: round1(TREE_BOX.minX + (cell.col + 0.5) * pitchX),
    y: round1(TREE_BOX.minY + (cell.row + 0.5) * pitchY),
  })

  const ids = new Map<string, string>([[cellKey(grid.root), ROOT_NODE_ID]])
  const nodes: ConstellationNode[] = [{ id: ROOT_NODE_ID, kind: 'root', parentId: null, ...place(grid.root), order: -1 }]
  const queue: ShapeCell[] = [grid.root]
  let reached = 0
  while (queue.length > 0) {
    const cell = queue.shift()!
    const neighbours = [...(grid.links.get(cellKey(cell)) ?? [])].sort((a, b) => a.row - b.row || a.col - b.col)
    for (const next of neighbours) {
      if (ids.has(cellKey(next))) continue
      const order = reached
      reached += 1
      ids.set(cellKey(next), `n${order}`)
      queue.push(next)
      // The drawn tips are pruned (D235).
      if (order >= def.cardNodes) continue
      nodes.push({ id: `n${order}`, kind: 'card', parentId: ids.get(cellKey(cell))!, ...place(next), order })
    }
  }
  if (reached !== total) throw new Error(`tier ${t} is not one connected tree`)

  for (const [index, side] of ([-1, 1] as const).entries()) {
    const parentId = `parent${index}`
    nodes.push({ id: parentId, kind: 'parent', parentId: null, x: 50 + side * 22, y: LINEAGE_BAND.parentY, order: -1 })
    for (const [gp, offset] of ([-12, 12] as const).entries()) {
      nodes.push({
        id: `${parentId}-gp${gp}`,
        kind: 'grandparent',
        parentId,
        x: 50 + side * 22 + offset,
        y: LINEAGE_BAND.grandparentY,
        order: -1,
      })
    }
  }

  return {
    tier: t,
    scenarioId: scenario.id,
    shape: def.shape,
    cardNodes: def.cardNodes,
    nodes,
  }
}

/** The ids the drawn tips had: a v11 unit's Produce nodes, which the v12 migration turns into Extra stats (D235). */
export const legacyProduceNodeIds = (tier: number): string[] =>
  Array.from({ length: DRAWN_TIPS }, (_, index) => `n${shapeDef(tier).cardNodes + index}`)

/** Drawable edges: card nodes to their parent, and each grandparent to its parent node. */
export function constellationEdges(
  template: ConstellationTemplate,
): { from: ConstellationNode; to: ConstellationNode }[] {
  const byId = new Map(template.nodes.map((node) => [node.id, node]))
  return template.nodes.flatMap((node) => {
    if (node.parentId === null) return []
    const parent = byId.get(node.parentId)
    return parent ? [{ from: parent, to: node }] : []
  })
}

const TEMPLATE_CACHE = new Map<number, ConstellationTemplate>()

export function constellationTemplate(tier: number): ConstellationTemplate {
  const t = clampTier(tier)
  let cached = TEMPLATE_CACHE.get(t)
  if (!cached) {
    cached = buildTemplate(t)
    TEMPLATE_CACHE.set(t, cached)
  }
  return cached
}

/** Structural rules every authored template must satisfy (T052 validates imports against this). */
export function validateTemplate(template: ConstellationTemplate): string | null {
  const byId = new Map(template.nodes.map((node) => [node.id, node]))
  if (byId.size !== template.nodes.length) return 'duplicate node id'

  const root = template.nodes.filter((node) => node.kind === 'root')
  if (root.length !== 1 || root[0]!.parentId !== null) return 'exactly one root with no parent is required'

  const cards = template.nodes.filter((node) => node.kind === 'card')
  if (cards.length !== template.cardNodes) return `expected ${template.cardNodes} card nodes, found ${cards.length}`

  // Card nodes form one connected tree rooted at the root.
  for (const node of cards) {
    let cursor: ConstellationNode | undefined = node
    const seen = new Set<string>()
    while (cursor && cursor.kind !== 'root') {
      if (seen.has(cursor.id)) return `cycle at ${node.id}`
      seen.add(cursor.id)
      if (cursor.parentId === null) return `${node.id} is not connected to the root`
      const next: ConstellationNode | undefined = byId.get(cursor.parentId)
      if (!next || (next.kind !== 'card' && next.kind !== 'root')) {
        return `${node.id} hangs off a ${next?.kind ?? 'missing'} node`
      }
      cursor = next
    }
    if (!cursor) return `${node.id} is not connected to the root`
  }

  const parents = template.nodes.filter((node) => node.kind === 'parent')
  if (parents.length !== 2) return 'exactly two parent nodes are required'
  for (const parent of parents) {
    if (parent.parentId !== null) return 'parent nodes are detached from the card tree'
    const children = template.nodes.filter((node) => node.kind === 'grandparent' && node.parentId === parent.id)
    if (children.length !== 2) return `${parent.id} must have exactly two grandparent nodes`
  }
  if (template.nodes.filter((node) => node.kind === 'grandparent').length !== 4) {
    return 'exactly four grandparent nodes are required'
  }

  const orders = cards.map((node) => node.order).sort((a, b) => a - b)
  if (orders.some((order, index) => order !== index)) return 'card node order must be 0..N-1'

  return null
}

// --- Unlocking ---------------------------------------------------------------------------------

export const clampTrainingLevel = (level: number): number =>
  Math.min(MAX_TRAINING_LEVEL, Math.max(1, Math.trunc(level)))

/** Card nodes open on a straight line from Training Level 1 to 8 (D235). */
export function unlockedNodeCount(tier: number, trainingLevel: number): number {
  const n = slotCount(tier)
  const tl = clampTrainingLevel(trainingLevel)
  if (tl >= NODE_UNLOCK_LEVELS) return n
  return Math.ceil((n * tl) / NODE_UNLOCK_LEVELS)
}

/** Historical TL gates, retained only as a migration reference. Live Inspiration never reads them (D250). */
export function lineageUnlockLevel(template: ConstellationTemplate, nodeId: string): number | null {
  const node = template.nodes.find((entry) => entry.id === nodeId)
  if (!node) return null
  if (node.kind === 'parent') return node.id === 'parent0' ? 9 : 10
  if (node.kind === 'grandparent') return node.parentId === 'parent0' ? 9 : 10
  return null
}

/** Live Training Level gate: 1–8 for cards; lineage has no TL gate and requires explicit tokens. */
export function nodeUnlockLevel(template: ConstellationTemplate, node: ConstellationNode): number {
  if (node.kind === 'root') return 1
  if (node.kind === 'parent' || node.kind === 'grandparent') return Infinity
  for (let level = 1; level < NODE_UNLOCK_LEVELS; level += 1) {
    if (node.order < unlockedNodeCount(template.tier, level)) return level
  }
  return NODE_UNLOCK_LEVELS
}

export function isNodeUnlocked(
  template: ConstellationTemplate,
  node: ConstellationNode,
  trainingLevel: number,
  inspiration?: { slots: readonly string[] },
): boolean {
  const tl = clampTrainingLevel(trainingLevel)
  if (node.kind === 'root') return true
  if (node.kind === 'card') return node.order < unlockedNodeCount(template.tier, tl)
  return inspiration?.slots.includes(node.id) ?? false
}

export function unlockedNodes(
  template: ConstellationTemplate,
  trainingLevel: number,
  inspiration?: { slots: readonly string[] },
): ConstellationNode[] {
  return template.nodes.filter((node) => isNodeUnlocked(template, node, trainingLevel, inspiration))
}

/** Which nodes a Training Level gain opens. Drives the Spark Match post-run summary. */
export function nodesUnlockedBetween(
  template: ConstellationTemplate,
  fromLevel: number,
  toLevel: number,
): ConstellationNode[] {
  const before = new Set(unlockedNodes(template, fromLevel).map((node) => node.id))
  return unlockedNodes(template, toLevel).filter((node) => !before.has(node.id))
}

// --- Derivation --------------------------------------------------------------------------------

export type NodeAssignment =
  | { kind: 'card'; cardId: string }
  | { kind: 'lineage'; templateId: string }

/** A v9–v11 Produce node filled from inventory. Only the v12 migration reads it (D205, D235). */
export interface ProduceAssignment {
  kind: 'produce'
  itemId: FarmCropId
  /** Monotonic per-node replacement revision. The first stocked fill is revision 1. */
  revision: number
}

/** A v9–v11 Produce node carried over from a pre-v9 Stat node. Only the v12 migration reads it. */
export interface LegacyProduceAssignment {
  kind: 'legacy-produce'
  stat: StatKey
}

/** What a v11 unit's nodes could hold, Produce included. */
export type LegacyNodeAssignment = NodeAssignment | ProduceAssignment | LegacyProduceAssignment

/** The stat a v11 Produce assignment paid in this scenario; malformed/stale assignments paid nothing. */
export function produceAssignmentStat(assignment: LegacyNodeAssignment | undefined, tier: number): StatKey | null {
  if (assignment?.kind === 'legacy-produce') return assignment.stat
  if (assignment?.kind !== 'produce') return null
  const crop = farmCropById(assignment.itemId)
  return crop?.scenarioTier === tier ? crop.stat : null
}

/** What one node filled with this card pays, before the stat split. The Cards album shows this. */
export function cardNodeValue(
  tier: number,
  card: { template: Pick<SupportCardTemplate, 'era'>; stars: number },
): number {
  return (nodeValue(tier) * starNodePct(card.stars) * eraPct(card.template.era, tier)) / 10_000
}

/**
 * Friend and Group cards — the non-trainee staff and teams the original game ties to its scenarios — pay skill
 * points instead of stats, in whatever slot they sit; every other card pays its stats (D132, superseding D124).
 */
export const paysSkillPoints = (template: Pick<SupportCardTemplate, 'type'>): boolean =>
  template.type === 'friend' || template.type === 'group'

/** What one node filled with a skill-point card pays, in SP. */
export function cardSpPerNode(
  tier: number,
  card: { template: Pick<SupportCardTemplate, 'era'>; stars: number },
): number {
  return (spNodeValue(tier) * starNodePct(card.stars) * eraPct(card.template.era, tier)) / 10_000
}

export interface CardNodeState {
  template: Pick<SupportCardTemplate, 'id' | 'type' | 'era' | 'effectProfile' | 'hintSkillIds'>
  stars: number
  /** Its gold skills (`cardGoldSkillIds`); each node pays the next one as well as the next white (D182). */
  goldSkillIds?: readonly string[]
}

export interface DeriveInput {
  tier: number
  trainingLevel: number
  template: ConstellationTemplate
  assignments: Readonly<Record<string, NodeAssignment>>
  cardSetIds: readonly string[]
  umaTemplate: Pick<UmaTemplate, 'baseStats' | 'growthRates'>
  cards: ReadonlyMap<string, CardNodeState>
  /** The unit's Extra stats grid; its active nodes pay (D235). None when omitted. */
  extraStats?: ExtraStats
  /** Acknowledged active-generation Farm vector. Even zero selects the new path, disabling retired Extra. */
  farmStats?: Stats
  inspiration?: { slots: readonly string[] }
  /** Career goals won in this scenario, for Trackblazer's Climax (D165). */
  goalsWon?: number
  /** The scenario's buff (D165); off only where a test checks the tree's own arithmetic. */
  buffs?: boolean
}

export interface DerivedStats {
  /** Post-growth, capped. What races read. */
  stats: Stats
  /** Pre-growth, pre-cap raw points. The invariance rule is about this. */
  raw: Stats
  rawTotal: number
  skillPoints: number
  /** Skill ids paid by card nodes, in assignment order, deduplicated. */
  cardSkillIds: string[]
  assignedNodes: number
  filledNodes: number
  /** Present only on the new path; raw/rawTotal remain card-only, never a Farm invariance claim. */
  farmSources?: FarmStatSources
}

export interface FarmStatSources {
  baseAndCards: Stats
  farm: Stats
  beforeCap: Stats
  marginal: Stats
  waste: Stats
}

/** Values accumulate as integers in units of 1/SCALE: four percentages (star, era, share, buff), so 100⁴. */
const SCALE = 100_000_000

/**
 * Stats, SP and card skills from one configuration. Pure and total: an assignment naming a card that is not
 * in the set, or a node that is not unlocked, contributes nothing rather than throwing.
 */
export function deriveStats(input: DeriveInput): DerivedStats {
  const { template, assignments, cards, umaTemplate } = input
  const value = nodeValue(input.tier)
  const spValue = spNodeValue(input.tier)
  const perCardCap = cardNodeCap(input.tier)
  const inSet = new Set(input.cardSetIds)
  const buff = input.buffs === false ? null : scenarioBuff(input.tier).id

  // First pass: which nodes pay, and how many live nodes each card fills. Past its cap a card pays nothing (D134);
  // nodes count in template order, so the earliest ones stay live. Cooking and Construction read the final counts.
  const live: { node: ConstellationNode; assignment: NodeAssignment }[] = []
  const cardNodesUsed = new Map<string, number>()
  let lineageFilled = 0
  let filled = 0
  for (const node of template.nodes) {
    if (node.kind === 'root' || !isNodeUnlocked(template, node, input.trainingLevel, input.inspiration)) continue
    if (node.kind === 'card') filled += 1
    const assignment = assignments[node.id]
    if (!assignment) continue
    if ((node.kind === 'parent' || node.kind === 'grandparent') && assignment.kind === 'lineage') lineageFilled += 1
    if (node.kind === 'card' && assignment.kind === 'card' && inSet.has(assignment.cardId) && cards.has(assignment.cardId)) {
      const used = cardNodesUsed.get(assignment.cardId) ?? 0
      if (used >= perCardCap) continue
      cardNodesUsed.set(assignment.cardId, used + 1)
      live.push({ node, assignment })
    }
  }

  // The scenario's buff on one card's nodes, in whole percent (D165).
  const setTypes = input.cardSetIds.map((id) => cards.get(id)?.template.type).filter((type) => type !== undefined)
  const setBonus = buff === 'team-spirit' ? lineageFilled * BUFF_VALUES.teamSpiritPerLineage
    : buff === 'climax' ? Math.min(BUFF_VALUES.climaxGoals, input.goalsWon ?? 0) * BUFF_VALUES.climaxPerGoal
      : buff === 'performance' && STATS.every((stat) => setTypes.includes(stat)) ? BUFF_VALUES.performance
        : 0
  const cardBuffPct = (cardId: string, card: CardNodeState): number => {
    const type = card.template.type
    const nodes = cardNodesUsed.get(cardId) ?? 0
    let bonus = setBonus
    if (buff === 'fragments' && card.stars >= BUFF_VALUES.fragmentsStars) bonus += BUFF_VALUES.fragments
    if (buff === 'expedition' && card.template.era >= BUFF_VALUES.expeditionEra) bonus += BUFF_VALUES.expedition
    if (buff === 'genres' && setTypes.filter((other) => other === type).length >= 2) bonus += BUFF_VALUES.genres
    if (buff === 'cooking' && nodes === perCardCap) bonus += BUFF_VALUES.cooking
    if (buff === 'research' && (type === 'speed' || type === 'power')) bonus += BUFF_VALUES.research
    if (buff === 'construction' && nodes === cardFairShare(input.tier)) bonus += BUFF_VALUES.construction
    if (buff === 'soak' && (type === 'stamina' || type === 'guts')) bonus += BUFF_VALUES.soak
    return 100 + bonus
  }

  // Accumulate in integer units of 1/SCALE so a full tree of max-broken cards lands on treeBudget exactly.
  const scaled: Record<StatKey, number> = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  let scaledSp = 0
  const cardSkillIds: string[] = []
  const skillCursor = new Map<string, number>()
  const statPct = buff === 'foundation' ? BUFF_VALUES.foundationStatPct : 100

  // The active Extra stat nodes, whatever the Training Level (D235).
  const extraCounts = input.farmStats === undefined && input.extraStats ? extraStatCounts(input.extraStats) : null
  let extraActive = 0
  for (const stat of STATS) {
    const count = extraCounts?.[stat] ?? 0
    extraActive += count
    scaled[stat] += count * EXTRA_STAT_NODE_VALUE * 100 * 100 * 100 * statPct
  }

  for (const { assignment } of live) {
    if (assignment.kind !== 'card') continue
    const card = cards.get(assignment.cardId)!
    const quality = starNodePct(card.stars) * eraPct(card.template.era, input.tier) * cardBuffPct(assignment.cardId, card)

    if (paysSkillPoints(card.template)) {
      scaledSp += spValue * quality
      // Orders (tier 14): a Friend or Group card also pays half a node as stats, split as its type splits them.
      if (buff === 'orders') {
        const shares = cardShares(card.template)
        for (const stat of STATS) scaled[stat] += (value * quality * (shares[stat] ?? 0) * BUFF_VALUES.ordersStatPct) / 100
      }
    } else {
      const shares = cardShares(card.template)
      for (const stat of STATS) scaled[stat] += value * quality * (shares[stat] ?? 0)
    }

    // Each node a card occupies pays the next of its golds while it has any (D182), and the next skill from its hints.
    const cursor = skillCursor.get(assignment.cardId) ?? 0
    skillCursor.set(assignment.cardId, cursor + 1)
    for (const skillId of [card.goldSkillIds?.[cursor], card.template.hintSkillIds[cursor]]) {
      if (skillId && !cardSkillIds.includes(skillId)) cardSkillIds.push(skillId)
    }
  }

  // Shared Light (tier 13): the two lowest stats the tree pays each gain +8%.
  if (buff === 'shared-light') {
    for (const stat of [...STATS].sort((left, right) => scaled[left] - scaled[right]).slice(0, 2)) {
      scaled[stat] = (scaled[stat] * (100 + BUFF_VALUES.sharedLight)) / 100
    }
  }
  const assigned = live.length + extraActive

  // Sum the integers, then divide once. Dividing per stat and adding the results loses the exactness at
  // tiers whose node value is not a dyadic fraction (tier 4's 168, for one).
  const raw = zeroStats()
  let scaledTotal = 0
  for (const stat of STATS) {
    raw[stat] = scaled[stat] / SCALE
    scaledTotal += scaled[stat]
  }
  const rawTotal = scaledTotal / SCALE

  // Her base stats plus the tree's gains, grown by her growth rates: the number shown is the number raced (D152).
  const caps = capProfile(input.tier)
  const stats = zeroStats()
  const farmSources: FarmStatSources | undefined = input.farmStats === undefined ? undefined : {
    baseAndCards: zeroStats(), farm: { ...input.farmStats }, beforeCap: zeroStats(), marginal: zeroStats(), waste: zeroStats(),
  }
  for (const stat of STATS) {
    const grown = umaTemplate.baseStats[stat] + raw[stat] * (1 + (umaTemplate.growthRates[stat] ?? 0))
    const farm = input.farmStats?.[stat] ?? 0
    if (!Number.isFinite(farm) || farm < 0) throw new RangeError('Invalid Farm stat vector')
    stats[stat] = Math.min(caps[stat], Math.round(grown + farm))
    if (farmSources) {
      farmSources.baseAndCards[stat] = grown
      farmSources.beforeCap[stat] = grown + farm
      farmSources.marginal[stat] = stats[stat] - Math.min(caps[stat], Math.round(grown))
      farmSources.waste[stat] = farm - farmSources.marginal[stat]
    }
  }

  return {
    stats,
    raw,
    rawTotal,
    skillPoints: Math.min(
      skillPointCap(input.tier),
      baselineSkillPoints(input.tier, input.trainingLevel) + Math.round(scaledSp / 1_000_000),
    ),
    cardSkillIds,
    assignedNodes: assigned,
    filledNodes: filled,
    ...(farmSources ? { farmSources } : {}),
  }
}
