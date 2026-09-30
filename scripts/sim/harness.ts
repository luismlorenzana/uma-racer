// Shared synthetic builds and skill kits for the balance scripts. Every id and number here is synthetic; nothing reads
// private or original-game content.
import {
  CARD_SET_SIZE,
  MAX_STARS,
  constellationTemplate,
  deriveStats,
  parseRaceCondition,
  rollRivalField,
  rollRivalSkills,
  shapeDef,
  unlockedNodeCount,
  type CardNodeState,
  type CompiledRaceSkill,
  type DistanceCategory,
  type NodeAssignment,
  type RaceGrade,
  type RaceSkillEffectKind,
  type StatKey,
  type Stats,
  type Strategy,
} from '../../packages/domain/src/index'
import { V7_TUNING, createRng } from '../../packages/race/src/index'

// Every sim can try an engine v7 tuning change without editing the engine: V7='{"hpScale":0.9}' pnpm sim:…
if (process.env.V7) Object.assign(V7_TUNING, JSON.parse(process.env.V7))

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
const umaTemplate = { baseStats: BASE, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } }
const flatProfile = { trainingBonus: 1, friendshipBonus: 1, statBonus: 1, skillPointBonus: 1, specialtyPriority: 1, hintFrequency: 1, raceBonus: 1, initialStats: 1 }

export const fairShare = (tier: number) => Math.ceil(shapeDef(tier).cardNodes / CARD_SET_SIZE)
export const cardCap = (tier: number) => fairShare(tier) + 1

export const SPRINT_GUTS: CardType[] = ['speed', 'speed', 'guts', 'wit', 'wit', 'friend']
export const SPRINT_POWER: CardType[] = ['speed', 'speed', 'power', 'wit', 'wit', 'friend']
export const STAYER: CardType[] = ['speed', 'speed', 'stamina', 'wit', 'wit', 'friend']
export const STAYER_POWER: CardType[] = ['speed', 'speed', 'stamina', 'power', 'wit', 'friend']
export const LONG: CardType[] = ['speed', 'speed', 'stamina', 'stamina', 'wit', 'friend']

export interface BuildOptions {
  /** Defaults to 10. Only the nodes open at this Training Level are filled, lowest order first. */
  trainingLevel?: number
  /** Nodes go to the Friend card first (its fair share, for SP) or last, when stats matter more than skills. */
  friend?: 'first' | 'last'
  /** Every card's stars in this scenario. Defaults to max, a fully bonded set. */
  stars?: number
  /** Cards (by deck index) filled to their cap right after the lean, before Speed and Wit. */
  first?: number[]
}

/**
 * Race stats for a six-card set, current era, maxed unless `stars` says otherwise. The card at `leanIndex` takes `lean`
 * nodes, any `first` cards fill to their cap, Speed then Wit fill what is left up to the per-card cap, and the Friend
 * card takes its fair share first or last.
 */
export function buildStats(tier: number, deck: CardType[], leanIndex: number, lean: number, statNodesTo: StatKey, options: BuildOptions = {}): Stats {
  const trainingLevel = options.trainingLevel ?? 10
  const template = constellationTemplate(tier)
  const ids = deck.map((type, index) => `${type}-${index}`)
  const cards = new Map<string, CardNodeState>(ids.map((id, index) => [id, {
    template: { id, type: deck[index]!, era: tier, effectProfile: flatProfile, hintSkillIds: [] },
    stars: options.stars ?? MAX_STARS,
  }]))
  const want = deck.map(() => 0)
  let left = shapeDef(tier).cardNodes
  const give = (index: number, count: number) => {
    const granted = Math.min(count, cardCap(tier) - want[index]!, left)
    want[index] = want[index]! + granted
    left -= granted
  }
  if (options.friend !== 'last') give(deck.indexOf('friend'), fairShare(tier))
  give(leanIndex, lean)
  for (const index of options.first ?? []) give(index, cardCap(tier))
  for (const type of ['speed', 'wit', 'guts', 'power', 'stamina', 'friend'] as CardType[]) {
    deck.forEach((card, index) => { if (card === type) give(index, cardCap(tier)) })
  }
  // Nodes open a few at a time, so the queue deals round the cards (the Friend card last when asked) the way a player
  // spreads a set; with every node open, as at TL10, the order changes nothing.
  const order = deck.map((_, index) => index).sort((a, b) =>
    Number(options.friend === 'last' && deck[a] === 'friend') - Number(options.friend === 'last' && deck[b] === 'friend'))
  const queue: string[] = []
  for (let round = 0; queue.length < want.reduce((sum, count) => sum + count, 0); round += 1) {
    for (const index of order) if (want[index]! > round) queue.push(ids[index]!)
  }
  const open = unlockedNodeCount(tier, trainingLevel)
  const assignments: Record<string, NodeAssignment> = {}
  for (const node of [...template.nodes].sort((a, b) => a.order - b.order)) {
    if (node.order >= open) continue
    if (node.kind === 'card' && queue.length > 0) assignments[node.id] = { kind: 'card', cardId: queue.shift()! }
    if (node.kind === 'stat') assignments[node.id] = { kind: 'legacy-produce', stat: statNodesTo }
  }
  return deriveStats({ tier, trainingLevel, template, assignments, cardSetIds: ids, umaTemplate, cards }).stats
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

export const categoryOf = (distance: number): DistanceCategory =>
  distance <= 1400 ? 'sprint' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'medium' : 'long'
export const FIELD_STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end']

/**
 * A typical course for the sims: the imported courses' median final straight (about 330 m) after a final corner,
 * and no hills, so duels can happen as they do in real races while results stay comparable across distances.
 */
export function typicalCourse(distance: number): { distance: number; surface: 'turf'; layout: { corners: { start: number; end: number; number: number }[]; straights: { start: number; end: number }[]; slopes: [] }; trackId: number; rotation: number } {
  const finalStraight = Math.min(330, distance / 3)
  const finalCorner = Math.min(300, distance / 4)
  const cornerEnd = distance - finalStraight
  return {
    distance,
    surface: 'turf',
    layout: {
      corners: [{ start: cornerEnd - finalCorner, end: cornerEnd, number: 4 }],
      straights: [{ start: 0, end: cornerEnd - finalCorner }, { start: cornerEnd, end: distance }],
      slopes: [],
    },
    trackId: 0,
    rotation: 2,
  }
}
