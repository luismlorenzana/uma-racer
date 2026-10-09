// Small deterministic T118 stat matrix (docs/research/farm-kitchen-balance.md). Invented cards/outfit, no content/save reads.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cardFairShare, cardNodeCap, capProfile, constellationTemplate, deriveStats, nodeValue,
  type CardNodeState, type DeriveInput, type NodeAssignment } from '../../packages/domain/src/constellation'
import { extraStatsFromProduce } from '../../packages/domain/src/extra-stats'
import { SCENARIOS } from '../../packages/domain/src/scenarios'
import { DISTANCE_CATEGORIES, STATS, zeroStats, type DistanceCategory, type Stats, type StatKey } from '../../packages/domain/src/types'
import { FARM_EXTRA_NODES, createFarmExtraBlock, farmExtraCapacity, farmExtraVector, farmIngredientBlock,
  previewFarmStats, setFarmActiveNodes, type FarmResult } from '../../packages/domain/src/farm/kitchen'

function take<T>(result: FarmResult<T>): T { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.value }
const baseStats: Stats = { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }
const flatProfile = { trainingBonus: 1, friendshipBonus: 1, statBonus: 1, skillPointBonus: 1, specialtyPriority: 1, hintFrequency: 1, raceBonus: 1, initialStats: 1 }
const growthProfiles = { neutral: zeroStats(), declared: { speed: 0.1, stamina: 0.1, power: 0, guts: 0, wit: 0 } }
const weights: Record<DistanceCategory, Stats> = {
  sprint: { speed: 4, stamina: 1, power: 2, guts: 1, wit: 1 },
  mile: { speed: 3, stamina: 2, power: 2, guts: 1, wit: 1 },
  medium: { speed: 2, stamina: 3, power: 2, guts: 1, wit: 1 },
  long: { speed: 2, stamina: 4, power: 1, guts: 2, wit: 1 },
}
function inputFor(tier: number, flex: StatKey, stars: number, era: number, growthRates: Stats): DeriveInput {
  const template = constellationTemplate(tier), deck = ['speed', 'speed', flex, 'wit', 'wit', 'friend'] as const
  const ids = deck.map((type, i) => `invented-${type}-${i}`)
  const cards = new Map<string, CardNodeState>(ids.map((id, i) => [id, {
    template: { id, type: deck[i]!, era, effectProfile: flatProfile, hintSkillIds: [] }, stars,
  }]))
  // Sixth Friend takes its existing fair SP share first; spread every other open card node, never exceed its cap.
  const nodes = template.nodes.filter(n => n.kind === 'card'), assignments: Record<string, NodeAssignment> = {}
  const want = deck.map(() => 0)
  for (const [i, node] of nodes.entries()) {
    const index = i < cardFairShare(tier) ? 5 : (i - cardFairShare(tier)) % 5
    assert.ok(want[index]! < cardNodeCap(tier)); want[index] = want[index]! + 1
    assignments[node.id] = { kind: 'card', cardId: ids[index]! }
  }
  return { tier, trainingLevel: 10, template, assignments, cardSetIds: ids, cards, umaTemplate: { baseStats, growthRates } }
}
function grown(input: DeriveInput, raw: Stats): Stats {
  return Object.fromEntries(STATS.map(stat => [stat, baseStats[stat] + raw[stat] * (1 + (input.umaTemplate.growthRates[stat] ?? 0))])) as Stats
}
function allocation(before: Stats, caps: Stats, distance: DistanceCategory, count: number): string[] {
  const left = [...FARM_EXTRA_NODES], active: string[] = [], vector = zeroStats()
  for (let i = 0; i < count; i++) {
    const score = (node: (typeof FARM_EXTRA_NODES)[number]) => STATS.reduce((n, stat) =>
      n + Math.min(node.stats[stat], Math.max(0, caps[stat] - before[stat] - vector[stat])) * weights[distance][stat], 0)
    left.sort((a, b) => score(b) - score(a) || FARM_EXTRA_NODES.indexOf(a) - FARM_EXTRA_NODES.indexOf(b))
    const node = left.shift()!; active.push(node.id)
    for (const stat of STATS) vector[stat] += node.stats[stat]
  }
  return active
}
interface MatrixRow {
  tier: number; flex: StatKey; stars: number; era: number; growth: string; distance: DistanceCategory
  nodeValue: number; capacity: number; skillPoints: number; active: string[]
  rawCard: Stats; postGrowth: Stats; cardOnly: Stats; partialFarm: Stats; partial: Stats; fullFarm: Stats; full: Stats; capWaste: Stats
}
const rows: MatrixRow[] = []
let cardOnlyChecks = 0
for (const scenario of SCENARIOS) for (const flex of ['stamina', 'power', 'guts'] as const) {
  for (const stars of [0, 1, 2, 3]) for (const era of [1, scenario.tier]) for (const [growthName, growthRates] of Object.entries(growthProfiles)) {
    const input = inputFor(scenario.tier, flex, stars, era, growthRates), card = deriveStats(input)
    const before = grown(input, card.raw), caps = capProfile(scenario.tier)
    assert.deepEqual(take(previewFarmStats(before, zeroStats(), caps)).stats, card.stats); cardOnlyChecks++
    // All four star ranks are invariance-tested; low/mid/max rows are the reported balance matrix.
    if (stars === 2) continue
    const capacity = farmExtraCapacity(scenario.tier), outfitId = 'invented-outfit'
    let map = { ...createFarmExtraBlock('matrix', outfitId, farmIngredientBlock(scenario.tier)), boughtNodeIds: FARM_EXTRA_NODES.map(n => n.id) }
    for (const distance of DISTANCE_CATEGORIES) {
      const active = allocation(before, caps, distance, capacity)
      map = take(setFarmActiveNodes({ map, outfitId, scenarioId: scenario.id, distance,
        unlockedScenarioIds: new Set([scenario.id]), nodeIds: active }))
      const partialFarm = take(farmExtraVector(active.slice(0, Math.ceil(capacity / 2))))
      const fullFarm = take(farmExtraVector(map.activeByScenario[scenario.id]![distance]))
      const partial = take(previewFarmStats(before, partialFarm, caps)), full = take(previewFarmStats(before, fullFarm, caps))
      assert.equal(STATS.reduce((n, stat) => n + fullFarm[stat], 0), capacity * 20)
      for (const stat of STATS) {
        assert.ok(full.stats[stat] >= partial.stats[stat] && partial.stats[stat] >= card.stats[stat])
        assert.equal(full.beforeCap[stat], before[stat] + fullFarm[stat])
      }
      rows.push({ tier: scenario.tier, flex, stars, era, growth: growthName, distance, nodeValue: nodeValue(scenario.tier), capacity,
        rawCard: card.raw, postGrowth: before, cardOnly: card.stats, skillPoints: card.skillPoints,
        active, partialFarm, partial: partial.stats, fullFarm, full: full.stats, capWaste: full.farmWaste })
    }
  }
}
assert.equal(cardOnlyChecks, 672); assert.equal(rows.length, 2016)

const foundation = Object.entries(growthProfiles).map(([growthName, growth]) => {
  const input = inputFor(1, 'stamina', 3, 1, growth), card = deriveStats(input)
  const old = deriveStats({ ...input, extraStats: extraStatsFromProduce(['speed', 'speed', 'speed', 'speed', 'power', 'power']) })
  const before = grown(input, card.raw), oldBefore = grown(input, old.raw)
  const vector = take(farmExtraVector(allocation(before, capProfile(1), 'sprint', 18)))
  return { growth: growthName, oldRawExtra: Number(STATS.reduce((n, stat) => n + old.raw[stat] - card.raw[stat], 0).toFixed(6)),
    oldGrownExtra: Number(STATS.reduce((n, stat) => n + oldBefore[stat] - before[stat], 0).toFixed(6)),
    newFlatExtra: STATS.reduce((n, stat) => n + vector[stat], 0) }
})
assert.deepEqual(foundation.map(row => row.oldRawExtra), [360, 360])
assert.deepEqual(foundation.map(row => row.newFlatExtra), [360, 360])
const cardless = SCENARIOS.map(s => {
  const input = inputFor(s.tier, 'stamina', 0, s.tier, zeroStats())
  const empty = deriveStats({ ...input, assignments: {}, cardSetIds: [], cards: new Map() })
  const active = allocation(baseStats, capProfile(s.tier), 'long', farmExtraCapacity(s.tier))
  const preview = take(previewFarmStats(baseStats, take(farmExtraVector(active)), capProfile(s.tier)))
  assert.deepEqual(empty.stats, baseStats)
  return { tier: s.tier, cardlessWithFarm: preview.stats, remainingCapGap: Object.fromEntries(STATS.map(stat => [stat, capProfile(s.tier)[stat] - preview.stats[stat]])) }
})
const digest = createHash('sha256').update(JSON.stringify({ rows, foundation, cardless })).digest('hex')
assert.equal(digest, '965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13', 'Reviewed stat envelope drift; update design/decision/evidence together')
const samples = rows.filter(r => [1, 5, 10, 14].includes(r.tier) && r.flex === 'stamina' && r.stars === 3 && r.era === r.tier && r.growth === 'declared')
const byTier = SCENARIOS.map(s => {
  const cells = rows.filter(r => r.tier === s.tier)
  return { tier: s.tier, nodeValue: nodeValue(s.tier), capacity: farmExtraCapacity(s.tier),
    marginalTotalRange: [Math.min(...cells.map(r => STATS.reduce((n, stat) => n + r.full[stat] - r.cardOnly[stat], 0))),
      Math.max(...cells.map(r => STATS.reduce((n, stat) => n + r.full[stat] - r.cardOnly[stat], 0)))],
    maximumFarmWaste: Math.max(...cells.map(r => STATS.reduce((n, stat) => n + r.capWaste[stat], 0))) }
})
const report = { cardOnlyChecks, matrixRows: rows.length, digest, assumptions: { baseStats, growthProfiles, weights }, byTier, foundation, samples, cardless }
if (process.argv.includes('--matrix')) console.log(JSON.stringify({ ...report, rows }, null, 2))
else if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`Farm flat stat matrix: ${cardOnlyChecks} exact card-only checks; ${rows.length} deterministic builds; sha256 ${digest}`)
  console.log('Foundation', JSON.stringify(foundation))
  for (const tier of byTier) console.log(JSON.stringify(tier))
  for (const row of samples) console.log(JSON.stringify(row))
  console.log('Cardless gaps (not a universal race-ready build)', JSON.stringify(cardless))
}
