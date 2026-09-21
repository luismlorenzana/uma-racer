// Per-scenario skill trees: budgets, node values, and derived stats (docs/design/constellations.md).

import { MAX_LIMIT_BREAK } from './cards'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { MAX_SCENARIO_TIER, SCENARIOS, baselineSpCap } from './scenarios'
import { STATS, type StatKey, type Stats, zeroStats } from './types'

export const MAX_TRAINING_LEVEL = 10
/** Training Levels 1–8 open card and stat nodes; 9 and 10 open lineage (docs/design/constellations.md). */
export const NODE_UNLOCK_LEVELS = 8
export const CARD_SET_SIZE = 6
/** The sixth slot is the scenario's dedicated slot: it pays Skill Points, never stats (D124). */
export const SCENARIO_SLOT_INDEX = 5
/** Fraction of a node's value the scenario slot pays as SP. */
export const SCENARIO_SLOT_SP_RATE = 0.25
/** A full constellation pays this share of the scenario's cap budget, so no build reaches every cap. */
export const TREE_BUDGET_SHARE = 0.6

/**
 * Per-stat caps. Tiers 1–4 are the original game's real values, verified 2026-09-20; tiers 5–14 extend the
 * idea on our own ladder (D119). Each row sums to that scenario's cap budget.
 */
export const CAP_PROFILES: readonly Stats[] = [
  { speed: 1400, stamina: 1400, power: 1400, guts: 1400, wit: 1400 }, // 1  URA Finale
  { speed: 1300, stamina: 1300, power: 1300, guts: 1300, wit: 1800 }, // 2  Unity Cup
  { speed: 1200, stamina: 1900, power: 1200, guts: 1200, wit: 1500 }, // 3  Trackblazer
  { speed: 1600, stamina: 1300, power: 1300, guts: 1500, wit: 1300 }, // 4  Our Grand Concert
  { speed: 1400, stamina: 1300, power: 1500, guts: 1250, wit: 1800 }, // 5  Grand Masters
  { speed: 1400, stamina: 1900, power: 1400, guts: 1500, wit: 1300 }, // 6  Project L'Arc
  { speed: 1600, stamina: 1550, power: 1600, guts: 1500, wit: 1500 }, // 7  U.A.F. Ready GO!
  { speed: 1500, stamina: 1700, power: 1500, guts: 1900, wit: 1400 }, // 8  Great Food Festival
  { speed: 1900, stamina: 1500, power: 1950, guts: 1500, wit: 1400 }, // 9  Run! Mecha Umamusume
  { speed: 2000, stamina: 1650, power: 1700, guts: 1550, wit: 1600 }, // 10 The Twinkle Legends
  { speed: 1750, stamina: 1750, power: 1750, guts: 1750, wit: 1750 }, // 11 Design Your Island
  { speed: 1700, stamina: 1900, power: 1700, guts: 2000, wit: 1700 }, // 12 Yukoma Hot Springs
  { speed: 2000, stamina: 1750, power: 1800, guts: 1700, wit: 2000 }, // 13 Beyond Dreams
  { speed: 1850, stamina: 1900, power: 2000, guts: 1950, wit: 1800 }, // 14 Tracen Diner
]

export interface ShapeDef {
  shape: string
  cardNodes: number
  statNodes: number
  /** How many chains grow out of the root. Decides the silhouette. */
  branches: number
}

/** Slot counts and silhouettes per scenario (docs/design/scenarios.md#constellation-shapes). */
export const CONSTELLATION_SHAPES: readonly ShapeDef[] = [
  { shape: 'single-trunk', cardNodes: 18, statNodes: 3, branches: 1 },
  { shape: 'three-branch', cardNodes: 20, statNodes: 4, branches: 3 },
  { shape: 'track-spurs', cardNodes: 17, statNodes: 3, branches: 2 },
  { shape: 'five-arm-star', cardNodes: 21, statNodes: 4, branches: 5 },
  { shape: 'twin-arcs', cardNodes: 25, statNodes: 4, branches: 2 },
  { shape: 'arch', cardNodes: 26, statNodes: 4, branches: 2 },
  { shape: 'three-colour', cardNodes: 27, statNodes: 4, branches: 3 },
  { shape: 'canopy', cardNodes: 27, statNodes: 5, branches: 4 },
  { shape: 'lattice-spine', cardNodes: 28, statNodes: 5, branches: 2 },
  { shape: 'crown', cardNodes: 29, statNodes: 5, branches: 7 },
  { shape: 'island-ring', cardNodes: 30, statNodes: 5, branches: 6 },
  { shape: 'spiral', cardNodes: 30, statNodes: 6, branches: 1 },
  { shape: 'twin-trunks', cardNodes: 31, statNodes: 6, branches: 2 },
  { shape: 'counter', cardNodes: 32, statNodes: 6, branches: 5 },
]

const clampTier = (tier: number): number => Math.min(MAX_SCENARIO_TIER, Math.max(1, Math.trunc(tier)))

export const capProfile = (tier: number): Stats => CAP_PROFILES[clampTier(tier) - 1]!

export const capBudget = (tier: number): number =>
  STATS.reduce((sum, stat) => sum + capProfile(tier)[stat], 0)

export const shapeDef = (tier: number): ShapeDef => CONSTELLATION_SHAPES[clampTier(tier) - 1]!

/** Total raw points a fully-filled constellation of max-limit-break cards pays. */
export const treeBudget = (tier: number): number => Math.round(TREE_BUDGET_SHARE * capBudget(tier))

export const slotCount = (tier: number): number => {
  const def = shapeDef(tier)
  return def.cardNodes + def.statNodes
}

/**
 * Raw points one node pays at max limit break. An integer for every modelled tier, which is what lets the
 * invariance rule be asserted exactly rather than within a tolerance.
 */
export const nodeValue = (tier: number): number => treeBudget(tier) / slotCount(tier)

// --- Cards -------------------------------------------------------------------------------------

export type CardNodeType = StatKey | 'friend' | 'group'

/**
 * How a card node splits its value, in integer percentage points so the arithmetic stays exact.
 * Every row sums to 100, which is what makes the invariance rule hold whatever you slot.
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

/** Percentage of a node's value a card pays, by limit break (D125). */
export const LB_NODE_PCT = [60, 70, 80, 90, 100] as const

export const lbNodePct = (limitBreak: number): number =>
  LB_NODE_PCT[Math.min(MAX_LIMIT_BREAK, Math.max(0, Math.trunc(limitBreak)))]!

export const MAX_CARD_TILT = 10

/**
 * A small per-card shift of the primary/secondary split, generated from the effect profile so two
 * max-broken Speed cards are not interchangeable. Integer percentage points in [−10, +10].
 */
export function cardTilt(template: Pick<SupportCardTemplate, 'type' | 'effectProfile'>): number {
  if (template.type === 'friend' || template.type === 'group') return 0
  const statWeight = template.effectProfile.statBonus ?? 0
  const trainingWeight = template.effectProfile.trainingBonus ?? 0
  const raw = Math.round((statWeight - trainingWeight) * 25)
  return Math.max(-MAX_CARD_TILT, Math.min(MAX_CARD_TILT, raw))
}

/**
 * The card's distribution with its tilt applied: value moves from the secondary stats to the primary.
 * Still sums to 100.
 */
export function cardShares(
  template: Pick<SupportCardTemplate, 'type' | 'effectProfile'>,
): Partial<Record<StatKey, number>> {
  const base = CARD_TYPE_SHARES[template.type as CardNodeType] ?? CARD_TYPE_SHARES.speed
  const tilt = cardTilt(template)
  if (tilt === 0) return { ...base }
  const primary = template.type as StatKey
  const secondaries = (Object.keys(base) as StatKey[]).filter((stat) => stat !== primary)
  if (secondaries.length === 0) return { ...base }

  const shares: Partial<Record<StatKey, number>> = { ...base }
  // Move `tilt` points to the primary, taken from the secondaries and never pushing one below zero.
  let moved = 0
  for (const [index, stat] of secondaries.entries()) {
    const want = index === secondaries.length - 1 ? tilt - moved : Math.trunc(tilt / secondaries.length)
    const take = Math.max(-(base[primary] ?? 0), Math.min(base[stat] ?? 0, want))
    shares[stat] = (shares[stat] ?? 0) - take
    moved += take
  }
  shares[primary] = (shares[primary] ?? 0) + moved
  return shares
}

// --- Templates ---------------------------------------------------------------------------------

export const NODE_KINDS = ['root', 'card', 'stat', 'parent', 'grandparent'] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export interface ConstellationNode {
  id: string
  kind: NodeKind
  /** Graph edge toward the root, or toward the owning parent node for a grandparent. */
  parentId: string | null
  /** Layout position in a 0–100 square. Authored, never simulated. */
  x: number
  y: number
  /** Unlock order among card and stat nodes; lineage nodes use their fixed Training Level instead. */
  order: number
}

export interface ConstellationTemplate {
  tier: number
  scenarioId: string
  shape: string
  cardNodes: number
  statNodes: number
  scenarioSlot: number
  nodes: ConstellationNode[]
}

export const ROOT_NODE_ID = 'root'

/**
 * Placeholder layouts derived from each scenario's shape parameters, so the engine is testable and the game
 * runs. T052 replaces these with fourteen authored trees — a generator cannot make fourteen silhouettes that
 * are actually different, which is the whole point of the shapes.
 */
export function buildTemplate(tier: number): ConstellationTemplate {
  const t = clampTier(tier)
  const def = shapeDef(t)
  const scenario = SCENARIOS[t - 1]!
  const nodes: ConstellationNode[] = [
    { id: ROOT_NODE_ID, kind: 'root', parentId: null, x: 50, y: 50, order: -1 },
  ]

  // Card and stat nodes fan out as `branches` chains; stat nodes sit at the chain tips, where the
  // free-choice release valve belongs.
  const total = def.cardNodes + def.statNodes
  const chains: string[][] = Array.from({ length: def.branches }, () => [])
  for (let i = 0; i < total; i += 1) chains[i % def.branches]!.push(`n${i}`)

  const spread = def.branches === 1 ? 0 : 300 / def.branches
  for (const [branchIndex, chain] of chains.entries()) {
    const angle = (-90 + (branchIndex - (def.branches - 1) / 2) * spread) * (Math.PI / 180)
    for (const [depth, id] of chain.entries()) {
      const radius = 9 + depth * 8
      // A chain's last node is a stat node until the scenario's stat budget is spent.
      nodes.push({
        id,
        kind: 'card',
        parentId: depth === 0 ? ROOT_NODE_ID : chain[depth - 1]!,
        x: Math.round((50 + Math.cos(angle) * radius) * 10) / 10,
        y: Math.round((50 + Math.sin(angle) * radius) * 10) / 10,
        order: depth * def.branches + branchIndex,
      })
    }
  }

  // Promote the deepest nodes to stat nodes, so they unlock last and sit at the tips.
  const byOrder = nodes.filter((node) => node.kind === 'card').sort((a, b) => b.order - a.order)
  for (const node of byOrder.slice(0, def.statNodes)) node.kind = 'stat'

  for (const [index, side] of ([-1, 1] as const).entries()) {
    const parentId = `parent${index}`
    nodes.push({ id: parentId, kind: 'parent', parentId: null, x: 50 + side * 25, y: 88, order: -1 })
    for (const [gp, offset] of ([-13, 13] as const).entries()) {
      nodes.push({
        id: `${parentId}-gp${gp}`,
        kind: 'grandparent',
        parentId,
        x: 50 + side * 25 + offset,
        y: 97,
        order: -1,
      })
    }
  }

  return {
    tier: t,
    scenarioId: scenario.id,
    shape: def.shape,
    cardNodes: def.cardNodes,
    statNodes: def.statNodes,
    scenarioSlot: SCENARIO_SLOT_INDEX,
    nodes,
  }
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
  const stats = template.nodes.filter((node) => node.kind === 'stat')
  if (cards.length !== template.cardNodes) return `expected ${template.cardNodes} card nodes, found ${cards.length}`
  if (stats.length !== template.statNodes) return `expected ${template.statNodes} stat nodes, found ${stats.length}`

  // Card and stat nodes form one connected tree rooted at the root.
  for (const node of [...cards, ...stats]) {
    let cursor: ConstellationNode | undefined = node
    const seen = new Set<string>()
    while (cursor && cursor.kind !== 'root') {
      if (seen.has(cursor.id)) return `cycle at ${node.id}`
      seen.add(cursor.id)
      if (cursor.parentId === null) return `${node.id} is not connected to the root`
      const next: ConstellationNode | undefined = byId.get(cursor.parentId)
      if (!next || (next.kind !== 'card' && next.kind !== 'stat' && next.kind !== 'root')) {
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

  const orders = [...cards, ...stats].map((node) => node.order).sort((a, b) => a - b)
  if (orders.some((order, index) => order !== index)) return 'card and stat node order must be 0..N-1'

  if (template.scenarioSlot < 0 || template.scenarioSlot >= CARD_SET_SIZE) return 'scenarioSlot out of range'
  return null
}

// --- Unlocking ---------------------------------------------------------------------------------

export const clampTrainingLevel = (level: number): number =>
  Math.min(MAX_TRAINING_LEVEL, Math.max(1, Math.trunc(level)))

/** Card and stat nodes open on a straight line from Training Level 1 to 8. */
export function unlockedNodeCount(tier: number, trainingLevel: number): number {
  const n = slotCount(tier)
  const tl = clampTrainingLevel(trainingLevel)
  if (tl >= NODE_UNLOCK_LEVELS) return n
  return Math.ceil((n * tl) / NODE_UNLOCK_LEVELS)
}

/** Parent A and its grandparents open at Training Level 9; parent B and hers at 10. */
export function lineageUnlockLevel(template: ConstellationTemplate, nodeId: string): number | null {
  const node = template.nodes.find((entry) => entry.id === nodeId)
  if (!node) return null
  if (node.kind === 'parent') return node.id === 'parent0' ? 9 : 10
  if (node.kind === 'grandparent') return node.parentId === 'parent0' ? 9 : 10
  return null
}

export function isNodeUnlocked(
  template: ConstellationTemplate,
  node: ConstellationNode,
  trainingLevel: number,
): boolean {
  const tl = clampTrainingLevel(trainingLevel)
  if (node.kind === 'root') return true
  if (node.kind === 'card' || node.kind === 'stat') {
    return node.order < unlockedNodeCount(template.tier, tl)
  }
  const required = lineageUnlockLevel(template, node.id)
  return required !== null && tl >= required
}

export function unlockedNodes(
  template: ConstellationTemplate,
  trainingLevel: number,
): ConstellationNode[] {
  return template.nodes.filter((node) => isNodeUnlocked(template, node, trainingLevel))
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
  | { kind: 'stat'; stat: StatKey }
  | { kind: 'lineage'; templateId: string }

export interface CardNodeState {
  template: Pick<SupportCardTemplate, 'id' | 'type' | 'effectProfile' | 'hintSkills'>
  limitBreak: number
}

export interface DeriveInput {
  tier: number
  trainingLevel: number
  template: ConstellationTemplate
  assignments: Readonly<Record<string, NodeAssignment>>
  cardSetIds: readonly string[]
  umaTemplate: Pick<UmaTemplate, 'baseStats' | 'growthRates'>
  cards: ReadonlyMap<string, CardNodeState>
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
}

const SCALE = 10_000

/**
 * Stats, SP and card skills from one configuration. Pure and total: an assignment naming a card that is not
 * in the set, or a node that is not unlocked, contributes nothing rather than throwing.
 */
export function deriveStats(input: DeriveInput): DerivedStats {
  const { template, assignments, cards, umaTemplate } = input
  const value = nodeValue(input.tier)
  const scenarioCardId = input.cardSetIds[template.scenarioSlot] ?? null
  const inSet = new Set(input.cardSetIds)

  // Accumulate in integer units of 1/SCALE so a full tree of max-broken cards lands on treeBudget exactly.
  const scaled: Record<StatKey, number> = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  let scaledSp = 0
  const cardSkillIds: string[] = []
  const skillCursor = new Map<string, number>()
  let assigned = 0
  let filled = 0

  for (const node of template.nodes) {
    if (node.kind === 'root' || !isNodeUnlocked(template, node, input.trainingLevel)) continue
    if (node.kind === 'card' || node.kind === 'stat') filled += 1
    const assignment = assignments[node.id]
    if (!assignment) continue

    if (node.kind === 'stat' && assignment.kind === 'stat') {
      assigned += 1
      scaled[assignment.stat] += value * 100 * 100
      continue
    }

    if (node.kind === 'card' && assignment.kind === 'card') {
      if (!inSet.has(assignment.cardId)) continue
      const card = cards.get(assignment.cardId)
      if (!card) continue
      assigned += 1
      const pct = lbNodePct(card.limitBreak)

      if (assignment.cardId === scenarioCardId) {
        scaledSp += value * pct * 100 * SCENARIO_SLOT_SP_RATE
      } else {
        const shares = cardShares(card.template)
        for (const stat of STATS) scaled[stat] += value * pct * (shares[stat] ?? 0)
      }

      // Each node a card occupies pays the next skill from its hint list.
      const used = skillCursor.get(assignment.cardId) ?? 0
      const skillId = card.template.hintSkills[used]
      skillCursor.set(assignment.cardId, used + 1)
      if (skillId && !cardSkillIds.includes(skillId)) cardSkillIds.push(skillId)
    }
  }

  // Sum the integers, then divide once. Dividing per stat and adding the results loses the exactness at
  // tiers whose node value is not a dyadic fraction (tier 4's 168, for one).
  const raw = zeroStats()
  let scaledTotal = 0
  for (const stat of STATS) {
    raw[stat] = scaled[stat] / SCALE
    scaledTotal += scaled[stat]
  }
  const rawTotal = scaledTotal / SCALE

  const caps = capProfile(input.tier)
  const stats = zeroStats()
  for (const stat of STATS) {
    const grown = umaTemplate.baseStats[stat] + raw[stat] * (1 + (umaTemplate.growthRates[stat] ?? 0))
    stats[stat] = Math.min(caps[stat], Math.round(grown))
  }

  return {
    stats,
    raw,
    rawTotal,
    skillPoints: Math.min(baselineSpCap(input.tier), Math.round(scaledSp / SCALE)),
    cardSkillIds,
    assignedNodes: assigned,
    filledNodes: filled,
  }
}
