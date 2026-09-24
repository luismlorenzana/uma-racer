// Constellation balance harness (docs/design/constellations.md#balance-targets, D134–D135).
// Every id and number below is synthetic; this script never reads private or original-game content.
//
//   pnpm sim:constellation            stamina ladder at every tier + G1 win rates
//   pnpm sim:constellation -- 400     races per win-rate cell (default 200)
//   pnpm sim:constellation -- --ladder-only
//
// Exit code 1 when a hard ladder check fails, so the stamina ladder is a regression gate.
import { npcRaceStats, type DistanceCategory, type Stats, type Strategy } from '../../packages/domain/src/index'
import { simulateRace } from '../../packages/race/src/index'
import {
  FIELD_STRATEGIES,
  NPC_KIT,
  PLAYER_KIT,
  SPRINT_GUTS,
  SPRINT_POWER,
  STAYER,
  buildStats,
  categoryOf,
  fairShare,
  goldRecovery,
} from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 200)
const LADDER_ONLY = args.includes('--ladder-only')
const tiersArg = args.find((value) => value.startsWith('--tiers='))?.split('=')[1]
const TIERS = tiersArg ? tiersArg.split(',').map(Number) : Array.from({ length: 14 }, (_, index) => index + 1)
const LADDER_RACES = 30

const configs = (tier: number) => ({
  'sprint (guts)': buildStats(tier, SPRINT_GUTS, 2, fairShare(tier), 'speed'),
  'sprint (power)': buildStats(tier, SPRINT_POWER, 2, fairShare(tier), 'speed'),
  'mile (stat nodes → stamina)': buildStats(tier, SPRINT_GUTS, 2, fairShare(tier), 'stamina'),
  'medium (1 stamina card)': buildStats(tier, STAYER, 2, fairShare(tier), 'speed'),
  'medium (stamina card +1)': buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'speed'),
  'long (stamina card +1, stat nodes → stamina)': buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'stamina'),
})

// --- Stamina ladder --------------------------------------------------------------------------------

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
