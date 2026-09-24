// Career check (docs/design/scenario-goals.md, D137): can every Uma finish her career at every tier?
//
//   pnpm sim:careers                        coverage of the private content pack + stage win rates
//   pnpm sim:careers -- --content=<dir>     read the pack from another folder (default content/data)
//   pnpm sim:careers -- 60                  races per win-rate cell (default 20)
//   pnpm sim:careers -- --tiers=1,5,9       tiers to race (default 1, 7, 14)
//   pnpm sim:careers -- --coverage-only     skip the win rates
//
// Coverage reads the local, gitignored content pack and prints only counts and tallies. Win rates use the synthetic
// builds and kits of the constellation harness (harness.ts). Exit code 1 when a career cannot be generated, a career leaves her
// profile or her B-or-better aptitudes, or a stage's race cannot reach a 25% win rate by Training Level 10.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAREER_STAGE_GRADES,
  GRADES,
  createScenarioTraining,
  createUmaSave,
  goalRaceIds,
  npcRaceStats,
  planScenarioCareer,
  type CareerStage,
  type DistanceCategory,
  type RaceTemplate,
  type Stats,
  type Strategy,
  type UmaTemplate,
} from '../../packages/domain/src/index'
import { simulateRace } from '../../packages/race/src/index'
import { FIELD_STRATEGIES, NPC_KIT, PLAYER_KIT, SPRINT_GUTS, SPRINT_POWER, STAYER, buildStats, fairShare, goldRecovery } from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 20)
const CONTENT = args.find((value) => value.startsWith('--content='))?.split('=')[1] ?? 'content/data'
const COVERAGE_ONLY = args.includes('--coverage-only')
const tiersArg = args.find((value) => value.startsWith('--tiers='))?.split('=')[1]
const TIERS_SAMPLED = tiersArg ? tiersArg.split(',').map(Number) : [1, 7, 14]
const TIERS = Array.from({ length: 14 }, (_, index) => index + 1)
let hardFailures = 0

// --- Coverage: every Uma, every tier ------------------------------------------------------------------------------

function readPack<T>(prefix: string): T[] {
  const file = readdirSync(CONTENT).find((name) => name.startsWith(`${prefix}.`) && name.endsWith('.json'))
  if (!file) throw new Error(`No ${prefix} pack in ${CONTENT}; run pnpm data:import or pass --content=<dir>`)
  return (JSON.parse(readFileSync(join(CONTENT, file), 'utf8')) as { items: T[] }).items
}

const races = readPack<RaceTemplate>('races')
const umas = readPack<UmaTemplate>('umas')
const byId = new Map(races.map((race) => [race.id, race]))
const eligible = (uma: UmaTemplate, race: RaceTemplate) =>
  GRADES.indexOf(uma.aptitudes.surface[race.surface]) <= GRADES.indexOf('B') &&
  GRADES.indexOf(uma.aptitudes.distance[race.distanceCategory]) <= GRADES.indexOf('B')

const tally = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)
const profiles = new Map<string, number>()
const mains = new Map<string, number>()
const outside = new Map<string, number>()
let careers = 0
let short = 0

for (const uma of umas) {
  for (const tier of TIERS) {
    const save = {
      ...createUmaSave(uma),
      level: (tier - 1) * 10 + 1,
      unlockedTier: tier,
      scenarios: TIERS.slice(0, tier).map((entry) => ({ ...createScenarioTraining(entry), started: true })),
    }
    let plan: ReturnType<typeof planScenarioCareer>
    try {
      plan = planScenarioCareer({ uma: save, umaTemplate: uma, aptitudes: uma.aptitudes, races })
    } catch (error) {
      hardFailures += 1
      console.error(`FAIL ${uma.id} T${tier}: ${(error as Error).message}`)
      continue
    }
    careers += 1
    if (tier === 1) tally(profiles, `${plan.profile.surface} ${plan.profile.band}`)
    tally(mains, plan.main)
    const main = plan.journey.goals.filter((goal) => goal.slot === 'main').flatMap(goalRaceIds)
    if (main.length < 3) short += 1
    for (const goal of plan.journey.goals) {
      for (const race of goalRaceIds(goal).map((id) => byId.get(id)!)) {
        const inProfile = race.surface === plan.profile.surface && plan.profile.distances.includes(race.distanceCategory)
        if (!inProfile) tally(outside, `${goal.slot}: outside her profile`)
        else if (!eligible(uma, race)) tally(outside, `${goal.slot}: below B`)
      }
    }
  }
}

const table = (map: Map<string, number>) => [...map].sort((left, right) => right[1] - left[1]).map(([key, count]) => `${key} ${count}`).join(' · ')
console.log(`Careers: ${careers} of ${umas.length * TIERS.length} (${umas.length} Umas × ${TIERS.length} tiers), ${races.length} races`)
console.log(`Profiles:   ${table(profiles)}`)
console.log(`Main plans: ${table(mains)}`)
console.log(`Fewer than 3 main races: ${short}`)
console.log(`Relaxed picks: ${outside.size === 0 ? 'none' : table(outside)}`)
// A relaxed pick is allowed by the generator (it never fails a career), but in the real pack none should be needed.
for (const [key, count] of outside) {
  hardFailures += count
  console.error(`FAIL ${count} career race(s) — ${key}`)
}

// --- Stage win rates ---------------------------------------------------------------------------------------------

/**
 * For each stage, the lowest Training Level at which its grade of race reaches a 35% win rate, with her best of four
 * strategies and two sensible decks for the distance (a stamina card helps any distance while the untrained floor is
 * low). Below TL6 she carries only the field's whites; from TL6 she has the SP for the golds (D133). The hard check
 * is that every stage race reaches 25% by TL10: retries are free, so a career is finishable when that holds.
 */
const SWEEP = [4, 6, 8, 10]
const TARGET = 35
const FLOOR = 25
const DECKS: Record<DistanceCategory, { distance: number; golds: number; builds: ((tier: number, trainingLevel: number) => Stats)[] }> = {
  sprint: { distance: 1400, golds: 0, builds: [
    (tier, trainingLevel) => buildStats(tier, SPRINT_POWER, 2, fairShare(tier), 'speed', { trainingLevel, friend: 'last' }),
    (tier, trainingLevel) => buildStats(tier, STAYER, 2, fairShare(tier), 'speed', { trainingLevel, friend: 'last' }),
  ] },
  mile: { distance: 1600, golds: 0, builds: [
    (tier, trainingLevel) => buildStats(tier, SPRINT_GUTS, 2, fairShare(tier), 'stamina', { trainingLevel, friend: 'last' }),
    (tier, trainingLevel) => buildStats(tier, STAYER, 2, fairShare(tier), 'stamina', { trainingLevel, friend: 'last' }),
  ] },
  medium: { distance: 2200, golds: 0, builds: [
    (tier, trainingLevel) => buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'speed', { trainingLevel, friend: 'last' }),
    (tier, trainingLevel) => buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'stamina', { trainingLevel, friend: 'last' }),
  ] },
  long: { distance: 2500, golds: 1, builds: [
    (tier, trainingLevel) => buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'stamina', { trainingLevel, friend: 'last' }),
  ] },
}

function bestWinRate(tier: number, stage: CareerStage, category: DistanceCategory, trainingLevel: number): number {
  const { distance, golds, builds } = DECKS[category]
  const kit = trainingLevel >= 6 ? [...PLAYER_KIT, ...[goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds)] : NPC_KIT
  const npc = npcRaceStats(tier, CAREER_STAGE_GRADES[stage], category, trainingLevel)
  let best = 0
  for (const build of builds) {
    const stats = build(tier, trainingLevel)
    for (const strategy of FIELD_STRATEGIES) {
      let wins = 0
      for (let race = 0; race < RACES; race += 1) {
        const playerGate = race % 12
        const timeline = simulateRace({
          course: { distance, surface: 'turf' },
          seed: 7_000_003 * tier + race * 7919,
          runners: Array.from({ length: 12 }, (_, gate) => gate === playerGate
            ? { id: 'player', label: String(gate + 1), stats, strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: kit }
            : { id: `npc-${gate}`, label: String(gate + 1), stats: npc, strategy: FIELD_STRATEGIES[gate % 4]!, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: NPC_KIT }),
        })
        if (timeline.results[0]!.id === 'player') wins += 1
      }
      best = Math.max(best, Math.round((100 * wins) / RACES))
    }
  }
  return best
}

if (!COVERAGE_ONLY) {
  console.log(`\nLowest Training Level with a ${TARGET}%+ win rate (best of 4 strategies and ${Object.values(DECKS)[0]!.builds.length} decks, ${RACES} races per cell, 12 runners)`)
  console.log('      maiden G3        trials G2        main G1')
  console.log('      spr mil med lng  spr mil med lng  spr mil med lng')
  for (const tier of TIERS_SAMPLED) {
    const cells = (['maiden', 'trials', 'main'] as const).map((stage) =>
      (['sprint', 'mile', 'medium', 'long'] as const).map((category) => {
        let reached: number | null = null
        for (const trainingLevel of SWEEP) {
          const rate = bestWinRate(tier, stage, category, trainingLevel)
          if (rate >= TARGET) { reached = trainingLevel; break }
          if (trainingLevel === 10 && rate < FLOOR) {
            hardFailures += 1
            console.error(`FAIL T${tier} ${stage} ${category}: ${rate}% at TL10`)
          }
        }
        return reached === null ? '  –' : String(reached).padStart(3)
      }).join(' '))
    console.log(`T${String(tier).padStart(2)}   ${cells.join('  ')}`)
  }
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} career check(s) failed`)
  process.exit(1)
}
