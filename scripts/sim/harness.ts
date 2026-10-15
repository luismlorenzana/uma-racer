// Shared synthetic builds and skill kits for the balance scripts. Every id and number here is synthetic; nothing reads
// private or original-game content.
import {
  CARD_EFFECTS,
  INSPIRATION_SLOTS,
  SCENARIO_BUFFS,
  STATS,
  parseRaceCondition,
  rollRivalField,
  rollRivalSkills,
  type Aptitudes,
  type CardEffect,
  type CompiledRaceSkill,
  type DistanceCategory,
  type InspirationSlot,
  type RaceGrade,
  type RaceSkillEffectKind,
  type StatKey,
  type Stats,
  type Strategy,
  type SupportCardTemplate,
  type UmaTemplate,
} from '../../packages/domain/src/index'
import { cardNodeId, fairShare as treeFairShare, perCardCap, treeCardNodesAt } from '../../packages/domain/src/training/trees/index'
import type { TypicalRow } from '../../packages/domain/src/builds/types'
import type { Preset, ScenarioOfTier, UmaBuild } from '../../packages/domain/src/state/index'
import { EXTRA_NODE_VALUES_TIER_1, REWORK_BUFF_TYPICAL, rollRivalFieldAt, tierAndScenario } from '../../packages/domain/src/tiers/index'
import { EXTRA_NODES, LAYERS, deriveBuild, extraCapacity, layerUnlocks, reworkBuff, type DerivedBuild, type TrainingContent } from '../../packages/domain/src/training/index'
import { V8_TUNING, createRng } from '../../packages/race/src/index'

// Every sim can try an engine v8 tuning change without editing the engine: V8='{"railDrift":0.5}' pnpm sim:…
if (process.env.V8) Object.assign(V8_TUNING, JSON.parse(process.env.V8))

// --- Synthetic kit -------------------------------------------------------------------------------

export const skill = (id: string, condition: string, kind: RaceSkillEffectKind, amount: number, duration: number,
  activation: 'guaranteed' | 'wit' = 'wit'): CompiledRaceSkill => ({
  id,
  activation,
  inherited: false,
  groups: [{
    precondition: null,
    condition: parseRaceCondition(condition)!,
    duration,
    cooldown: 0,
    effects: [{ kind, amount }],
    unsupportedVariables: [],
    unsupportedEffects: [],
  }],
})
/** A gold recovery: 5.5% of max HP, the original's gold-tier heal. */
export const goldRecovery = (id: string, at: number) => skill(id, `hp_per<=${at}`, 'recovery', 0.055, 0, 'guaranteed')
/** The documented baseline enemy kit: one recovery, one mid-race speed, one late speed, one acceleration (whites). */
export const NPC_KIT = [
  skill('npc-recovery', 'hp_per<=60', 'recovery', 0.015, 0, 'guaranteed'),
  skill('npc-middle', 'phase_random==1', 'target-speed', 0.15, 3),
  skill('npc-late', 'phase_random==2', 'target-speed', 0.15, 3),
  skill('npc-acceleration', 'phase_random==2', 'acceleration', 0.2, 3),
]
/** A Lv5 unique of the common shape (D158): late-race speed for 5 s, guaranteed, as the original's uniques are. */
export const unique = (id: string) => skill(id, 'phase_random==2', 'target-speed', 0.35 * 1.1, 5, 'guaranteed')
/**
 * The rival white pool (D163), shaped like the real one (about 480 whites): mostly speed, then passives, acceleration,
 * heals and straight-line speed, at the originals' typical white values, some tied to a running style.
 */
export const RIVAL_POOL: CompiledRaceSkill[] = [
  ...['phase_random==0', 'phase_random==1', 'phase_random==1', 'phase_random==2', 'phase_random==2', 'phase_random==3',
    'is_finalcorner==1', 'is_last_straight==1', 'corner_random==1', 'straight_random==1', 'phase==1&order_rate<=50',
    'phase_random==2&order_rate>50'].map((condition, index) => skill(`w-speed-${index}`, condition, 'target-speed', 0.15, 2.4)),
  ...['running_style==1&phase_random==1', 'running_style==2&phase_random==2', 'running_style==3&phase_random==2',
    'running_style==4&phase_random==3'].map((condition, index) => skill(`w-style-${index}`, condition, 'target-speed', 0.15, 2.4)),
  ...['phase==2', 'is_finalcorner==1', 'is_lastspurt==1', 'running_style==4&phase==2']
    .map((condition, index) => skill(`w-accel-${index}`, condition, 'acceleration', 0.2, 2.4)),
  ...['hp_per<=60', 'phase_random==1', 'corner_random==1'].map((condition, index) => skill(`w-heal-${index}`, condition, 'recovery', 0.015, 0, 'guaranteed')),
  ...['straight_random==1', 'is_last_straight==1'].map((condition, index) => skill(`w-line-${index}`, condition, 'current-speed-natural', 0.15, 2.4)),
  ...(['passive-speed', 'passive-stamina', 'passive-power', 'passive-guts', 'passive-wit'] as const)
    .map((kind) => skill(`w-${kind}`, 'always==1', kind, 40, 0, 'guaranteed')),
]

/** A rival's kit: her own unique and her rolled whites (D163), from a stream of her own. */
export function rivalKit(strategy: Strategy, distance: number, seed: number): CompiledRaceSkill[] {
  const rng = createRng((seed ^ 0x2545f491) >>> 0)
  return [unique('npc-unique'), ...rollRivalSkills(RIVAL_POOL, { strategy, course: { distance, surface: 'turf' }, rng })]
}
/** What an SP budget in the thousands buys (D133): a few golds on top of her own unique and the field's whites. */
export const PLAYER_KIT = [
  unique('player-unique'),
  ...NPC_KIT,
  skill('gold-late-speed', 'phase_random==2', 'target-speed', 0.35, 3),
  skill('gold-acceleration', 'phase_random==2', 'acceleration', 0.4, 3),
]

// --- Synthetic Uma and cards ---------------------------------------------------------------------

export type CardType = 'speed' | 'stamina' | 'power' | 'guts' | 'wit' | 'friend'
/** Median base stats of the imported roster, zero growth: the typical Uma, not a favourable one. */
const BASE: Stats = { speed: 110, stamina: Number(process.env.BASE_STAMINA ?? 105), power: 110, guts: Number(process.env.BASE_GUTS ?? 110), wit: 110 }

export const SPRINT_GUTS: CardType[] = ['speed', 'speed', 'guts', 'wit', 'wit', 'friend']
export const STAYER: CardType[] = ['speed', 'speed', 'stamina', 'wit', 'wit', 'friend']
export const STAYER_POWER: CardType[] = ['speed', 'speed', 'stamina', 'power', 'wit', 'friend']
export const LONG: CardType[] = ['speed', 'speed', 'stamina', 'stamina', 'wit', 'friend']

export interface BuildOptions {
  /** Nodes go to the Friend card first (its fair share, for SP) or last, when stats matter more than skills. */
  friend?: 'first' | 'last'
  /** Cards (by deck index) filled to their cap right after the lean, before Speed and Wit. */
  first?: number[]
}

/** The stat that best backs up a lean (D235): Guts behind Stamina, which spends less HP on the spurt; Power behind Speed. */
const EXTRA_BACKUP: Record<StatKey, StatKey> = { speed: 'power', stamina: 'guts', power: 'speed', guts: 'stamina', wit: 'speed' }

/**
 * How many of `cardNodes` each deck card fills: the Friend card its fair share first (unless last), the card at
 * `leanIndex` `lean` nodes, any `first` cards to the per-card cap, then Speed, Wit, Guts, Power, Stamina and Friend to
 * the cap in turn, until the nodes run out.
 */
export function allocateNodes(cardNodes: number, share: number, cap: number, deck: CardType[], leanIndex: number, lean: number,
  options: Pick<BuildOptions, 'friend' | 'first'> = {}): number[] {
  const want = deck.map(() => 0)
  let left = cardNodes
  const give = (index: number, count: number) => {
    const granted = Math.min(count, cap - want[index]!, left)
    want[index] = want[index]! + granted
    left -= granted
  }
  if (options.friend !== 'last') give(deck.indexOf('friend'), share)
  give(leanIndex, lean)
  for (const index of options.first ?? []) give(index, cap)
  for (const type of ['speed', 'wit', 'guts', 'power', 'stamina', 'friend'] as CardType[]) {
    deck.forEach((card, index) => { if (card === type) give(index, cap) })
  }
  return want
}

/**
 * The node queue for an allocation: nodes open a few at a time, so it deals round the cards (the Friend card last when
 * asked) the way a player spreads a set; with every node open, the order changes nothing.
 */
export function dealNodes(ids: string[], want: number[], deck: CardType[], options: Pick<BuildOptions, 'friend'> = {}): string[] {
  const order = deck.map((_, index) => index).sort((a, b) =>
    Number(options.friend === 'last' && deck[a] === 'friend') - Number(options.friend === 'last' && deck[b] === 'friend'))
  const queue: string[] = []
  for (let round = 0; queue.length < want.reduce((sum, count) => sum + count, 0); round += 1) {
    for (const index of order) if (want[index]! > round) queue.push(ids[index]!)
  }
  return queue
}

/**
 * A generated rival field (D153) for a race of `size` runners with the player at `playerGate`: the rivals' runners, in
 * gate order around her, with the rival kit. Seeded per race, as the game seeds it from the attempt.
 */
export function rivalRunners(tier: number, grade: RaceGrade, distance: number, size: number, playerGate: number, seed: number) {
  const slots = rollRivalField({ tier, grade, distance: categoryOf(distance), meters: distance, count: size - 1, rng: createRng(seed ^ 0x5bd1e995) })
  return slots.map((slot, index) => {
    const gate = index < playerGate ? index : index + 1
    return { id: `rival-${gate}`, label: String(gate + 1), stats: slot.stats, strategy: slot.strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      skills: rivalKit(slot.strategy, distance, seed * 131 + gate) }
  })
}

// --- The rework's builds (docs/rework/03-uma-progression.md §8–§9, 04 §7–§8, 05 §4 and §6; T133) ---------------------
// A full-layer build at the game's scenario T on T128's `deriveBuild`: the re-authored tree of N card nodes all open,
// every card of the current era at 100% (no stars), the Inspiration slots her layers open filled, and the scenario's
// Extra Stats capacity active. Rivals are T125's `rollRivalFieldAt`. Every Uma, parent and card here is invented.

const APTITUDE_A = {
  surface: { turf: 'A', dirt: 'A' },
  distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
  strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' },
} as Aptitudes
const synthetic = (id: string): UmaTemplate => ({
  id, charaId: `chara-${id}`, name: `Synthetic ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { ...BASE }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes: APTITUDE_A,
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: '',
})
/** The sims' Uma: the median base stats above, zero growth, A everywhere. */
export const REWORK_UMA = synthetic('sim-uma')
/** One invented parent per Inspiration slot, each her own character, so every open slot can be filled. */
const REWORK_PARENTS: Readonly<Record<InspirationSlot, UmaTemplate>> = Object.fromEntries(
  INSPIRATION_SLOTS.map((slot, index) => [slot, synthetic(`sim-parent-${index}`)])) as Record<InspirationSlot, UmaTemplate>
const NO_EFFECTS = Object.fromEntries(CARD_EFFECTS.map((key) => [key, 0])) as Record<CardEffect, number>

/** An invented card of a type and era, its own character, with no skills or effects: only its node value matters. */
export const reworkCard = (type: CardType, era: number, index: number): SupportCardTemplate => ({
  id: `${type}-${index}`, charaId: `chara-${type}-${index}`, charName: `Synthetic ${type} ${index}`, title: `${type}-${index}`, type,
  jpRelease: '2000-01-01', era, obtain: 'free', starter: true, hintSkillIds: [], eventSkillIds: [], effectProfile: NO_EFFECTS,
  uniqueEffect: null, imageSource: '',
})

/** A card's fair share and the per-card cap on scenario T's re-authored tree (D134): 2/3, 3/4, 4/5, 4/5, 5/6. */
export const reworkFairShare = (T: number) => treeFairShare(treeCardNodesAt(T))
export const reworkCardCap = (T: number) => perCardCap(treeCardNodesAt(T))

/**
 * The active Extra Stats a preset leaning on `stat` turns on in scenario s of a tier: every opened node that pays the
 * stat, most first (singles, then Duos, then Suns), then the nodes that pay its backup (Guts behind Stamina, Power
 * behind Speed, as today's six), up to the capacity (05 §6). Map order breaks ties.
 */
export function leanExtraNodes(scenario: ScenarioOfTier, stat: StatKey): string[] {
  const backup = EXTRA_BACKUP[stat]
  const pays = (node: (typeof EXTRA_NODES)[number], paid: StatKey) => (node.stats.includes(paid) ? EXTRA_NODE_VALUES_TIER_1[node.kind] : 0)
  return EXTRA_NODES.map((node, index) => ({ node, index }))
    .filter(({ node }) => node.layer <= scenario)
    .sort((a, b) => pays(b.node, stat) - pays(a.node, stat) || pays(b.node, backup) - pays(a.node, backup) || a.index - b.index)
    .slice(0, extraCapacity(scenario))
    .map(({ node }) => node.id)
}

export interface ReworkBuildOptions extends Pick<BuildOptions, 'friend' | 'first'> {
  /** Career goals won in the scenario, for Climax (04 §8). Defaults to 2, the typical Uma's when she races her G1s. */
  goalsWon?: number
  /** The scenario's buff; off only to measure what it adds. */
  buffs?: boolean
}

/**
 * One preset of a full-layer build at scenario T: the sims' card allocation on the re-authored tree (the lean,
 * `first` cards to the cap, Speed then Wit, the Friend card first or last), every Inspiration slot her layers open
 * filled, and Extra Stats leaning on `statNodesTo` at the scenario's capacity. Derived by T128's `deriveBuild`.
 */
export function reworkBuild(T: number, deck: CardType[], leanIndex: number, lean: number, statNodesTo: StatKey,
  options: ReworkBuildOptions = {}): DerivedBuild {
  const at = tierAndScenario(T)
  const N = treeCardNodesAt(T)
  const cards = deck.map((type, index) => reworkCard(type, T, index))
  const ids = cards.map((card) => card.id)
  const queue = dealNodes(ids, allocateNodes(N, reworkFairShare(T), reworkCardCap(T), deck, leanIndex, lean, options), deck, options)
  const unlocks = LAYERS.filter((s) => s <= at.scenario).flatMap((s) => layerUnlocks(s))
  const targets = (...kinds: string[]) => unlocks.filter((entry) => kinds.includes(entry.kind)).map((entry) => entry.target)
  const slots = targets('slot') as InspirationSlot[]
  const preset: Preset = {
    cardSetIds: ids,
    assignments: Object.fromEntries(queue.map((cardId, index) => [cardNodeId(index + 1), cardId])),
    lineage: Object.fromEntries(slots.map((slot) => [slot, REWORK_PARENTS[slot].id])),
    activeExtraNodes: leanExtraNodes(at.scenario, statNodesTo),
    loadoutSkillIds: [],
  }
  const build: UmaBuild = {
    constellationOpened: N,
    inspiration: { slots, uniques: targets('unique') as InspirationSlot[], golds: targets('gold') },
    extraNodes: targets('single', 'duo', 'sun'),
    bonds: ids,
    presets: { sprint: preset, mile: preset, medium: preset, long: preset },
  }
  const content: TrainingContent = {
    umas: new Map([REWORK_UMA, ...Object.values(REWORK_PARENTS)].map((uma) => [uma.id, uma])),
    cards: new Map(cards.map((card) => [card.id, card])),
    skills: new Map(),
  }
  return deriveBuild({ at, build, preset: 'mile', template: REWORK_UMA, content, goalsWon: options.goalsWon ?? 2, buffs: options.buffs })
}

/** A rework build's race stats. */
export const reworkStats = (...args: Parameters<typeof reworkBuild>): Stats => reworkBuild(...args).stats

/** `rivalRunners` on T125's fields: scenario T's typical trained Uma at today's handicaps, seeded the same way. */
export function rivalRunnersAt(T: number, grade: RaceGrade, distance: number, size: number, playerGate: number, seed: number) {
  const slots = rollRivalFieldAt({ T, grade, distance: categoryOf(distance), meters: distance, count: size - 1, rng: createRng(seed ^ 0x5bd1e995) })
  return slots.map((slot, index) => {
    const gate = index < playerGate ? index : index + 1
    return { id: `rival-${gate}`, label: String(gate + 1), stats: slot.stats, strategy: slot.strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      skills: rivalKit(slot.strategy, distance, seed * 131 + gate) }
  })
}

/**
 * The rework's typical build (04 §8, 06 §2 "What a typical build needs"): the stamina ladder's set for each distance,
 * full layer, every card current-era at 100%, Extra Stats at capacity, the Friend card on its fair share, her open
 * Inspiration slots filled and two career goals won.
 */
export const REWORK_TYPICAL_SETS: readonly { distance: DistanceCategory; build: (T: number, options?: ReworkBuildOptions) => DerivedBuild }[] = [
  { distance: 'sprint', build: (T, options) => reworkBuild(T, STAYER, 2, reworkFairShare(T), 'speed', options) },
  { distance: 'mile', build: (T, options) => reworkBuild(T, STAYER, 2, reworkFairShare(T), 'stamina', options) },
  { distance: 'medium', build: (T, options) => reworkBuild(T, STAYER_POWER, 2, reworkFairShare(T) + 1, 'stamina', { ...options, first: [3] }) },
  { distance: 'long', build: (T, options) => reworkBuild(T, LONG, 2, reworkFairShare(T) + 1, 'stamina', { ...options, first: [3] }) },
]

/** A build's tree in raw points: card points and Extra Stats, before growth and caps (what a buff's share is of). */
const treePoints = (build: DerivedBuild) => build.cardRawTotal + STATS.reduce((sum, stat) => sum + build.extra[stat], 0)

/**
 * What scenario T's buff adds to the rework's typical build, as a share of her tree (today's measure, D165): each
 * distance's set with the buff over the same set without it, averaged over the four sets.
 */
export function reworkBuffTypical(T: number): { typical: number; bySet: Record<DistanceCategory, number> } {
  const bySet = Object.fromEntries(REWORK_TYPICAL_SETS.map(({ distance, build }) =>
    [distance, treePoints(build(T)) / treePoints(build(T, { buffs: false })) - 1])) as Record<DistanceCategory, number>
  const values = Object.values(bySet)
  return { typical: values.reduce((sum, value) => sum + value, 0) / values.length, bySet }
}

/** Each buff's typical value at the given T, rounded to a hundredth of a point: what the reports keep (04 §8). */
export function reworkTypicalRows(Ts: readonly number[]): TypicalRow[] {
  const round = (value: number) => Math.round(value * 10_000) / 10_000
  return Ts.map((T) => {
    const { typical, bySet } = reworkBuffTypical(T)
    return { T, measured: round(typical), bySet: Object.fromEntries(Object.entries(bySet).map(([set, value]) => [set, round(value)])) as TypicalRow['bySet'] }
  })
}

/**
 * The typical values as both rework sims print them: today's, measured and what rivals carry (`REWORK_BUFF_TYPICAL`).
 * A measurement more than half a point from today's is re-pinned to it (T133); a row whose pin disagrees says so.
 */
export function typicalLines(rows: readonly TypicalRow[]): string[] {
  const pct = (value: number) => `${(100 * value).toFixed(1)}%`
  return [
    "Scenario buffs' typical gain on the rework's typical build (the ladder's four sets, full layer, two goals won), as a share of her tree",
    'T    buff            today   measured   rivals carry   by set: sprint · mile · medium · long',
    ...rows.map((row) => {
      const today = SCENARIO_BUFFS[row.T - 1]!.typical
      const carried = REWORK_BUFF_TYPICAL[row.T - 1]!
      const expected = Math.abs(row.measured - today) > 0.005 ? Math.round(row.measured * 1000) / 1000 : today
      const flag = carried !== expected ? `  ← rivals should carry ${pct(expected)}: re-pin` : expected !== today ? '  (re-pinned)' : ''
      const sets = (['sprint', 'mile', 'medium', 'long'] as const).map((set) => pct(row.bySet[set])).join(' · ')
      return `T${String(row.T).padStart(2)}  ${reworkBuff(row.T).name.padEnd(14)}  ${pct(today).padStart(5)}   ${pct(row.measured).padStart(7)}    ${pct(carried).padStart(7)}       ${sets}${flag}`
    }),
  ]
}

export const categoryOf = (distance: number): DistanceCategory =>
  distance <= 1400 ? 'sprint' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'medium' : 'long'
export const FIELD_STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end']

/**
 * A typical course for the sims: the imported courses' median final straight (about 330 m) after a final corner,
 * and no hills, so duels can happen as they do in real races while results stay comparable across distances.
 */
export function typicalCourse(distance: number): { distance: number; surface: 'turf'; layout: { corners: { start: number; end: number; number: number }[]; straights: { start: number; end: number; frontType: 1 | 2 }[]; slopes: [] }; trackId: number; rotation: number; grade: number } {
  // A synthetic oval, laid out back from the finish like a mid-size course: a 350 m home straight after the final turn
  // (corners 4 and 3, a quarter-turn each over 250 m), a 400 m back straight, the first turn (corners 2 and 1), and so on.
  const pattern: readonly ({ kind: 'straight'; length: number; frontType: 1 | 2 } | { kind: 'corner'; length: number; number: number })[] = [
    { kind: 'straight', length: 350, frontType: 1 },
    { kind: 'corner', length: 250, number: 4 },
    { kind: 'corner', length: 250, number: 3 },
    { kind: 'straight', length: 400, frontType: 2 },
    { kind: 'corner', length: 250, number: 2 },
    { kind: 'corner', length: 250, number: 1 },
  ]
  const corners: { start: number; end: number; number: number }[] = []
  const straights: { start: number; end: number; frontType: 1 | 2 }[] = []
  let end = distance
  for (let index = 0; end > 0; index += 1) {
    const segment = pattern[index % pattern.length]!
    const start = Math.max(0, end - segment.length)
    if (segment.kind === 'corner') corners.unshift({ start, end, number: segment.number })
    else straights.unshift({ start, end, frontType: segment.frontType })
    end = start
  }
  return { distance, surface: 'turf', layout: { corners, straights, slopes: [] }, trackId: 0, rotation: 2, grade: 100 }
}
