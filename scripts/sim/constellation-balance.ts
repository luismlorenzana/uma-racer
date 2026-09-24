// Constellation balance harness (docs/design/constellations.md#balance-targets, D134–D135).
// Every id and number below is synthetic; this script never reads private or original-game content.
//
//   pnpm sim:constellation            stamina ladder at every tier + G1 win rates
//   pnpm sim:constellation -- 400     races per win-rate cell (default 200)
//   pnpm sim:constellation -- --ladder-only
//
// Exit code 1 when a hard ladder check fails, so the stamina ladder is a regression gate.
import {
  CARD_SET_SIZE,
  applyForm,
  constellationTemplate,
  deriveStats,
  npcRaceStats,
  parseRaceCondition,
  shapeDef,
  yourForm,
  type CardNodeState,
  type CompiledRaceSkill,
  type DistanceCategory,
  type NodeAssignment,
  type RaceSkillEffectKind,
  type StatKey,
  type Stats,
  type Strategy,
} from '../../packages/domain/src/index'
import { simulateRace } from '../../packages/race/src/index'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 200)
const LADDER_ONLY = args.includes('--ladder-only')
const tiersArg = args.find((value) => value.startsWith('--tiers='))?.split('=')[1]
const TIERS = tiersArg ? tiersArg.split(',').map(Number) : Array.from({ length: 14 }, (_, index) => index + 1)
const LADDER_RACES = 30

// --- Synthetic kit -------------------------------------------------------------------------------

const skill = (id: string, condition: string, kind: RaceSkillEffectKind, amount: number, duration: number,
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
const goldRecovery = (id: string, at: number) => skill(id, `hp_per<=${at}`, 'recovery', 0.055, 0, 'guaranteed')
/** The documented baseline enemy kit: one recovery, one mid-race speed, one late speed, one acceleration (whites). */
const NPC_KIT = [
  skill('npc-recovery', 'hp_per<=60', 'recovery', 0.015, 0, 'guaranteed'),
  skill('npc-middle', 'phase_random==1', 'target-speed', 0.15, 3),
  skill('npc-late', 'phase_random==2', 'target-speed', 0.15, 3),
  skill('npc-acceleration', 'phase_random==2', 'acceleration', 0.2, 3),
]
/** What an SP budget in the thousands buys (D133): a few golds on top of the field's whites. */
const PLAYER_KIT = [
  ...NPC_KIT,
  skill('gold-late-speed', 'phase_random==2', 'target-speed', 0.35, 3),
  skill('gold-acceleration', 'phase_random==2', 'acceleration', 0.4, 3),
]

// --- Synthetic Uma and cards ---------------------------------------------------------------------

type CardType = 'speed' | 'stamina' | 'power' | 'guts' | 'wit' | 'friend'
/** Median base stats of the imported roster, zero growth: the typical Uma, not a favourable one. */
const BASE: Stats = { speed: 110, stamina: Number(process.env.BASE_STAMINA ?? 105), power: 110, guts: Number(process.env.BASE_GUTS ?? 110), wit: 110 }
const umaTemplate = { baseStats: BASE, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } }
const flatProfile = { trainingBonus: 1, friendshipBonus: 1, statBonus: 1, skillPointBonus: 1, specialtyPriority: 1, hintFrequency: 1, raceBonus: 1, initialStats: 1 }

const cardCap = (tier: number) => Math.ceil(shapeDef(tier).cardNodes / CARD_SET_SIZE) + 1
const fairShare = (tier: number) => Math.ceil(shapeDef(tier).cardNodes / CARD_SET_SIZE)

/**
 * Race stats for a six-card set at TL10, current era, max bond. The Friend card takes its fair share for SP, the
 * card at `leanIndex` takes `lean` nodes, and Speed then Wit fill what is left up to the per-card cap.
 */
function buildStats(tier: number, deck: CardType[], leanIndex: number, lean: number, statNodesTo: StatKey): Stats {
  const template = constellationTemplate(tier)
  const ids = deck.map((type, index) => `${type}-${index}`)
  const cards = new Map<string, CardNodeState>(ids.map((id, index) => [id, {
    template: { id, type: deck[index]!, era: tier, effectProfile: flatProfile, hintSkillIds: [] },
    limitBreak: 4,
  }]))
  const want = deck.map(() => 0)
  let left = shapeDef(tier).cardNodes
  const give = (index: number, count: number) => {
    const granted = Math.min(count, cardCap(tier) - want[index]!, left)
    want[index] = want[index]! + granted
    left -= granted
  }
  give(deck.indexOf('friend'), fairShare(tier))
  give(leanIndex, lean)
  for (const type of ['speed', 'wit', 'guts', 'power', 'stamina'] as CardType[]) {
    deck.forEach((card, index) => { if (card === type) give(index, cardCap(tier)) })
  }
  const queue = ids.flatMap((id, index) => Array.from({ length: want[index]! }, () => id))
  const assignments: Record<string, NodeAssignment> = {}
  for (const node of template.nodes) {
    if (node.kind === 'card' && queue.length > 0) assignments[node.id] = { kind: 'card', cardId: queue.shift()! }
    if (node.kind === 'stat') assignments[node.id] = { kind: 'stat', stat: statNodesTo }
  }
  const derived = deriveStats({ tier, trainingLevel: 10, template, assignments, cardSetIds: ids, umaTemplate, cards })
  return applyForm(derived.stats, yourForm(10))
}

const SPRINT_GUTS: CardType[] = ['speed', 'speed', 'guts', 'wit', 'wit', 'friend']
const SPRINT_POWER: CardType[] = ['speed', 'speed', 'power', 'wit', 'wit', 'friend']
const STAYER: CardType[] = ['speed', 'speed', 'stamina', 'wit', 'wit', 'friend']

const configs = (tier: number) => ({
  'sprint (guts)': buildStats(tier, SPRINT_GUTS, 2, fairShare(tier), 'speed'),
  'sprint (power)': buildStats(tier, SPRINT_POWER, 2, fairShare(tier), 'speed'),
  'mile (stat nodes → stamina)': buildStats(tier, SPRINT_GUTS, 2, fairShare(tier), 'stamina'),
  'medium (1 stamina card)': buildStats(tier, STAYER, 2, fairShare(tier), 'speed'),
  'medium (stamina card +1)': buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'speed'),
  'long (stamina card +1, stat nodes → stamina)': buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'stamina'),
})

// --- Stamina ladder --------------------------------------------------------------------------------

const categoryOf = (distance: number): DistanceCategory =>
  distance <= 1400 ? 'sprint' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'medium' : 'long'
const FIELD_STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end']

/**
 * Whether a build reaches a full spurt without running out of HP in at least 90% of 12-runner G1 races. Measured in
 * a field, not alone: position keeping in a pack burns roughly 40% more HP, which is what the original game's own
 * stamina charts assume.
 */
function fullSpurt(tier: number, stats: Stats, distance: number, strategy: Strategy, golds = 0): boolean {
  const npc = npcRaceStats(tier, 'g1', categoryOf(distance), 10)
  let good = 0
  for (let race = 0; race < LADDER_RACES; race += 1) {
    const gate = race % 12
    const timeline = simulateRace({
      course: { distance, surface: 'turf' },
      seed: 31_337 + tier * 101 + race * 7919,
      runners: Array.from({ length: 12 }, (_, g) => g === gate
        ? { id: 'P', label: String(g + 1), stats, strategy, gate: g, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
            skills: [goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds) }
        : { id: `n${g}`, label: String(g + 1), stats: npc, strategy: FIELD_STRATEGIES[g % 4]!, gate: g, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: NPC_KIT }),
    })
    const me = timeline.results.find((result) => result.id === 'P')!
    if (me.spurtMaxed && !timeline.events.some((event) => event.type === 'hp-empty' && event.runner === gate)) good += 1
  }
  return good >= LADDER_RACES * 0.9
}

interface Check { name: string; stats: keyof ReturnType<typeof configs>; distance: number; golds?: number; expect: boolean; hard: boolean }
/** D134's ladder: each step is enough for its distance, and — where the soft checks hold — needed for the next. */
const CHECKS: Check[] = [
  { name: 'sprint (guts) runs 1,400 m', stats: 'sprint (guts)', distance: 1400, expect: true, hard: true },
  { name: 'sprint (power) runs 1,400 m', stats: 'sprint (power)', distance: 1400, expect: true, hard: true },
  { name: 'mile runs 1,800 m', stats: 'mile (stat nodes → stamina)', distance: 1800, expect: true, hard: true },
  { name: 'medium runs 2,200 m', stats: 'medium (1 stamina card)', distance: 2200, expect: true, hard: true },
  { name: 'medium, stamina card leaned one node, runs 2,400 m', stats: 'medium (stamina card +1)', distance: 2400, expect: true, hard: true },
  { name: 'medium runs 2,400 m without leaning', stats: 'medium (1 stamina card)', distance: 2400, expect: true, hard: false },
  { name: 'long runs 2,500 m', stats: 'long (stamina card +1, stat nodes → stamina)', distance: 2500, expect: true, hard: true },
  { name: 'long runs 3,000 m with one gold recovery', stats: 'long (stamina card +1, stat nodes → stamina)', distance: 3000, golds: 1, expect: true, hard: true },
  { name: 'long runs 3,200 m with two gold recoveries', stats: 'long (stamina card +1, stat nodes → stamina)', distance: 3200, golds: 2, expect: true, hard: true },
  { name: 'a sprint set cannot run 1,800 m', stats: 'sprint (guts)', distance: 1800, expect: false, hard: false },
  { name: 'stat nodes alone cannot run 2,400 m', stats: 'mile (stat nodes → stamina)', distance: 2400, expect: false, hard: false },
  { name: 'one stamina card alone cannot run 3,000 m', stats: 'medium (1 stamina card)', distance: 3000, expect: false, hard: false },
]

let hardFailures = 0
console.log('Stamina ladder — in 12-runner G1 fields, pace and late, TL10, max bond, current era, median base stats, zero growth')
for (const tier of TIERS) {
  const built = configs(tier)
  const misses: string[] = []
  for (const check of CHECKS) {
    const ok = (['pace', 'late'] as Strategy[]).every((strategy) =>
      fullSpurt(tier, built[check.stats], check.distance, strategy, check.golds ?? 0) === check.expect)
    if (!ok) {
      misses.push(`${check.hard ? 'FAIL' : 'soft'}: ${check.name}`)
      if (check.hard) hardFailures += 1
    }
  }
  const stamina = Object.values(built).map((stats) => Math.round(stats.stamina)).join(' / ')
  console.log(`T${String(tier).padStart(2)}  stamina ${stamina}  ${misses.length === 0 ? 'ok' : misses.join('; ')}`)
}

// --- G1 win rates -------------------------------------------------------------------------------------

if (!LADDER_ONLY) {
  // Each cell races the build the ladder says is right for that distance, with the heals it calls for.
  const CATEGORY: Record<DistanceCategory, { distance: number; config: keyof ReturnType<typeof configs>; golds: number }> = {
    sprint: { distance: 1400, config: 'sprint (power)', golds: 0 },
    mile: { distance: 1600, config: 'mile (stat nodes → stamina)', golds: 0 },
    medium: { distance: 2400, config: 'medium (stamina card +1)', golds: 0 },
    long: { distance: 3000, config: 'long (stamina card +1, stat nodes → stamina)', golds: 1 },
  }
  const winRate = (tier: number, category: DistanceCategory, strategy: Strategy): number => {
    const { distance, config, golds } = CATEGORY[category]
    const stats = configs(tier)[config]
    const kit = [...PLAYER_KIT, ...[goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds)]
    const npc = npcRaceStats(tier, 'g1', category, 10)
    let wins = 0
    for (let race = 0; race < RACES; race += 1) {
      const playerGate = race % 12
      const timeline = simulateRace({
        course: { distance, surface: 'turf' },
        seed: 1_000_003 * tier + race * 7919,
        runners: Array.from({ length: 12 }, (_, gate) => gate === playerGate
          ? { id: 'player', label: String(gate + 1), stats, strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: kit }
          : { id: `npc-${gate}`, label: String(gate + 1), stats: npc, strategy: FIELD_STRATEGIES[gate % 4]!, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: NPC_KIT }),
      })
      if (timeline.results[0]!.id === 'player') wins += 1
    }
    return Math.round((100 * wins) / RACES)
  }
  console.log(`\nG1 win rate at TL10 (target about 55–75%), ${RACES} races per cell, 12 runners — pace / best strategy`)
  for (const tier of TIERS) {
    const cells = (Object.keys(CATEGORY) as DistanceCategory[]).map((category) => {
      const rates = FIELD_STRATEGIES.map((strategy) => winRate(tier, category, strategy))
      return `${category} ${String(rates[1]).padStart(3)}% / ${String(Math.max(...rates)).padStart(3)}%`
    })
    console.log(`T${String(tier).padStart(2)}  ${cells.join('  ')}`)
  }
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} hard ladder check(s) failed`)
  process.exit(1)
}
