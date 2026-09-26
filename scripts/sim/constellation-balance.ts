// Constellation balance harness (docs/design/constellations.md#balance-targets, D134–D135, D152).
// Every id and number below is synthetic; this script never reads private or original-game content.
//
//   pnpm sim:constellation            stamina ladder at every tier + G1 win rates
//   pnpm sim:constellation -- 400     races per win-rate cell (default 200)
//   pnpm sim:constellation -- --ladder-only
//   pnpm sim:constellation -- --rates-only
//
// Exit code 1 when a hard ladder check fails, so the stamina ladder is a regression gate.
import type { DistanceCategory, Stats, Strategy } from '../../packages/domain/src/index'
import { SPURT_BUFFER_METERS, simulateRace } from '../../packages/race/src/index'
import {
  FIELD_STRATEGIES,
  LONG,
  PLAYER_KIT,
  SPRINT_GUTS,
  STAYER,
  STAYER_POWER,
  buildStats,
  fairShare,
  goldRecovery,
  rivalRunners,
  typicalCourse,
} from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 200)
const LADDER_ONLY = args.includes('--ladder-only')
const RATES_ONLY = args.includes('--rates-only')
const tiersArg = args.find((value) => value.startsWith('--tiers='))?.split('=')[1]
const TIERS = tiersArg ? tiersArg.split(',').map(Number) : Array.from({ length: 14 }, (_, index) => index + 1)
const LADDER_RACES = 30

// Each rung adds a stamina source: a stamina card, then the stat nodes, then a lean and a Power card, then a second
// stamina card (D152). Stats start at base, so no rung is free.
const configs = (tier: number) => ({
  'no stamina card': buildStats(tier, SPRINT_GUTS, 2, fairShare(tier), 'stamina'),
  'sprint (1 stamina card)': buildStats(tier, STAYER, 2, fairShare(tier), 'speed'),
  'mile (stamina card, stat nodes → stamina)': buildStats(tier, STAYER, 2, fairShare(tier), 'stamina'),
  'medium (stamina card +1)': buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'stamina'),
  'medium (stamina card +1, power card)': buildStats(tier, STAYER_POWER, 2, fairShare(tier) + 1, 'stamina', { first: [3] }),
  'long (2 stamina cards)': buildStats(tier, LONG, 2, fairShare(tier) + 1, 'stamina', { first: [3] }),
})

// --- Stamina ladder --------------------------------------------------------------------------------

/**
 * Whether a build reaches a full spurt in at least 90% of 12-runner G1 races, each against a freshly rolled field
 * (D153), with HP lasting to within 60 m of the line: the stretch the original's spurt plan leaves out (engine v7,
 * D158). Measured in a field, not alone: position keeping and the pushes before the spurt burn HP, which is what the
 * original game's own stamina charts assume.
 */
function fullSpurt(tier: number, stats: Stats, distance: number, strategy: Strategy, golds = 0): boolean {
  let good = 0
  for (let race = 0; race < LADDER_RACES; race += 1) {
    const gate = race % 12
    const seed = 31_337 + tier * 101 + race * 7919
    const player = { id: 'P', label: String(gate + 1), stats, strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      skills: [goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds) }
    const timeline = simulateRace({
      course: typicalCourse(distance),
      seed,
      runners: [...rivalRunners(tier, 'g1', distance, 12, gate, seed), player].sort((left, right) => left.gate - right.gate),
    })
    const me = timeline.results.find((result) => result.id === 'P')!
    const dry = timeline.events.find((event) => event.type === 'hp-empty' && event.runner === gate)
    const dryAt = dry ? timeline.distance[dry.tick * timeline.runnerCount + gate]! : Number.POSITIVE_INFINITY
    if (me.spurtMaxed && dryAt >= distance - SPURT_BUFFER_METERS) good += 1
  }
  return good >= LADDER_RACES * 0.9
}

interface Check { name: string; stats: keyof ReturnType<typeof configs>; distance: number; golds?: number; expect: boolean; hard: boolean }
/** D152's ladder: each step is enough for its distance, and — where the soft checks hold — needed for the next. */
const CHECKS: Check[] = [
  { name: 'one stamina card runs 1,400 m', stats: 'sprint (1 stamina card)', distance: 1400, expect: true, hard: true },
  { name: 'stat nodes into stamina run 1,800 m', stats: 'mile (stamina card, stat nodes → stamina)', distance: 1800, expect: true, hard: true },
  { name: 'a Power card runs 2,200 m', stats: 'medium (stamina card +1, power card)', distance: 2200, expect: true, hard: true },
  { name: 'a Power card runs 2,400 m', stats: 'medium (stamina card +1, power card)', distance: 2400, expect: true, hard: true },
  { name: 'a lean alone runs 2,200 m', stats: 'medium (stamina card +1)', distance: 2200, expect: true, hard: false },
  { name: 'two stamina cards run 2,500 m', stats: 'long (2 stamina cards)', distance: 2500, expect: true, hard: true },
  { name: 'two stamina cards run 3,000 m with one gold recovery', stats: 'long (2 stamina cards)', distance: 3000, golds: 1, expect: true, hard: true },
  { name: 'two stamina cards run 3,200 m with two gold recoveries', stats: 'long (2 stamina cards)', distance: 3200, golds: 2, expect: true, hard: true },
  { name: 'no stamina card cannot run 1,400 m', stats: 'no stamina card', distance: 1400, expect: false, hard: false },
  { name: 'a sprint set cannot run 1,800 m', stats: 'sprint (1 stamina card)', distance: 1800, expect: false, hard: false },
  { name: 'a lean alone cannot run 2,400 m', stats: 'medium (stamina card +1)', distance: 2400, expect: false, hard: false },
  { name: 'a Power card cannot run 3,000 m', stats: 'medium (stamina card +1, power card)', distance: 3000, golds: 1, expect: false, hard: false },
]

let hardFailures = 0
if (!RATES_ONLY) console.log('Stamina ladder — in 12-runner G1 fields, pace and late, TL10, max bond, current era, median base stats, zero growth')
for (const tier of RATES_ONLY ? [] : TIERS) {
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
    sprint: { distance: 1400, config: 'sprint (1 stamina card)', golds: 0 },
    mile: { distance: 1600, config: 'mile (stamina card, stat nodes → stamina)', golds: 0 },
    medium: { distance: 2400, config: 'medium (stamina card +1, power card)', golds: 0 },
    long: { distance: 3000, config: 'long (2 stamina cards)', golds: 1 },
  }
  const winRate = (tier: number, category: DistanceCategory, strategy: Strategy): number => {
    const { distance, config, golds } = CATEGORY[category]
    const stats = configs(tier)[config]
    const kit = [...PLAYER_KIT, ...[goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds)]
    let wins = 0
    for (let race = 0; race < RACES; race += 1) {
      const playerGate = race % 12
      const seed = 1_000_003 * tier + race * 7919
      const player = { id: 'player', label: String(playerGate + 1), stats, strategy, gate: playerGate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: kit }
      const timeline = simulateRace({
        course: typicalCourse(distance),
        seed,
        runners: [...rivalRunners(tier, 'g1', distance, 12, playerGate, seed), player].sort((left, right) => left.gate - right.gate),
      })
      if (timeline.results[0]!.id === 'player') wins += 1
    }
    return Math.round((100 * wins) / RACES)
  }
  console.log(`\nG1 win rate at TL10, fully bonded (the G1 handicap, D152), ${RACES} races per cell, 12 runners — pace / best strategy`)
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
