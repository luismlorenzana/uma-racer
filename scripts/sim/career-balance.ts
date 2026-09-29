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
// profile or her B-or-better aptitudes, or a fully trained, fully bonded Uma wins a stage's race under 25% of the time (D152).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAREER_STAGE_GRADES,
  GRADES,
  careerRaceCatalog,
  createScenarioTraining,
  createUmaSave,
  goalRaceIds,
  planScenarioCareer,
  regularRaceCatalog,
  type CareerStage,
  type DistanceCategory,
  type RaceTemplate,
  type Stats,
  type Strategy,
  type UmaTemplate,
} from '../../packages/domain/src/index'
import { simulateRace } from '../../packages/race/src/index'
import { FIELD_STRATEGIES, LONG, PLAYER_KIT, STAYER, STAYER_POWER, buildStats, fairShare, goldRecovery, rivalRunners, typicalCourse } from './harness'

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

const sourceRaces = readPack<RaceTemplate>('races')
const races = careerRaceCatalog(sourceRaces)
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
let unavailableFrozenTargets = 0

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
    // Plans frozen before catalog curation may name retired or same-name source variants. Every exact target that
    // still exists in the private registry must remain runnable, even though it is absent from the ordinary catalog.
    const historical = planScenarioCareer({ uma: save, umaTemplate: uma, aptitudes: uma.aptitudes, races: sourceRaces })
    const historicalTargets = historical.journey.goals.flatMap(goalRaceIds)
    const presentedIds = new Set(regularRaceCatalog(sourceRaces, historicalTargets).map((race) => race.id))
    unavailableFrozenTargets += historicalTargets.filter((id) => !presentedIds.has(id)).length
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
console.log(`Unavailable historical frozen targets: ${unavailableFrozenTargets}`)
if (unavailableFrozenTargets > 0) hardFailures += unavailableFrozenTargets
// A relaxed pick is allowed by the generator (it never fails a career), but in the real pack none should be needed.
for (const [key, count] of outside) {
  hardFailures += count
  console.error(`FAIL ${count} career race(s) — ${key}`)
}

// --- Stage win rates ---------------------------------------------------------------------------------------------

/**
 * Each stage's race at TL10, the way the owner plays: train fully, then race (D152). Her best of four strategies and
 * the decks for the distance, with the golds her SP buys, once with a new set (0★) and once fully bonded (5★). The
 * fully bonded Uma must win every stage's race at least FLOOR% of the time; retries are free, so that is finishable.
 */
const FLOOR = 25
const STARS = [0, 5] as const
// The stamina ladder's decks for each distance (constellations.md#balance-targets), with the Friend card last or first.
// Sprints and miles also try a Power card (engine v7, D158): acceleration decides short races, as in the original.
const DECKS: Record<DistanceCategory, { distance: number; golds: number; builds: ((tier: number, stars: number) => Stats)[] }> = {
  sprint: { distance: 1400, golds: 0, builds: [
    (tier, stars) => buildStats(tier, STAYER, 2, fairShare(tier), 'speed', { stars, friend: 'last' }),
    (tier, stars) => buildStats(tier, STAYER, 2, fairShare(tier), 'speed', { stars }),
    (tier, stars) => buildStats(tier, STAYER_POWER, 2, fairShare(tier), 'speed', { stars, friend: 'last' }),
  ] },
  mile: { distance: 1600, golds: 0, builds: [
    (tier, stars) => buildStats(tier, STAYER, 2, fairShare(tier), 'stamina', { stars, friend: 'last' }),
    (tier, stars) => buildStats(tier, STAYER, 2, fairShare(tier), 'stamina', { stars }),
    (tier, stars) => buildStats(tier, STAYER_POWER, 2, fairShare(tier), 'stamina', { stars, friend: 'last' }),
  ] },
  medium: { distance: 2200, golds: 0, builds: [
    (tier, stars) => buildStats(tier, STAYER_POWER, 2, fairShare(tier) + 1, 'stamina', { stars, first: [3], friend: 'last' }),
    (tier, stars) => buildStats(tier, STAYER, 2, fairShare(tier) + 1, 'stamina', { stars, friend: 'last' }),
  ] },
  long: { distance: 2500, golds: 1, builds: [
    (tier, stars) => buildStats(tier, LONG, 2, fairShare(tier) + 1, 'stamina', { stars, first: [3], friend: 'last' }),
  ] },
}

function bestWinRate(tier: number, stage: CareerStage, category: DistanceCategory, stars: number): number {
  const { distance, golds, builds } = DECKS[category]
  const kit = [...PLAYER_KIT, ...[goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds)]
  let best = 0
  for (const build of builds) {
    const stats = build(tier, stars)
    for (const strategy of FIELD_STRATEGIES) {
      let wins = 0
      for (let race = 0; race < RACES; race += 1) {
        const playerGate = race % 12
        const seed = 7_000_003 * tier + race * 7919
        const player = { id: 'player', label: String(playerGate + 1), stats, strategy, gate: playerGate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: kit }
        const timeline = simulateRace({
          course: typicalCourse(distance),
          seed,
          runners: [...rivalRunners(tier, CAREER_STAGE_GRADES[stage], distance, 12, playerGate, seed), player].sort((left, right) => left.gate - right.gate),
        })
        if (timeline.results[0]!.id === 'player') wins += 1
      }
      best = Math.max(best, Math.round((100 * wins) / RACES))
    }
  }
  return best
}

if (!COVERAGE_ONLY) {
  console.log(`\nStage win rates at TL10 (best of 4 strategies and the decks per distance, ${RACES} races per cell, 12 runners; 5★ floor ${FLOOR}%)`)
  console.log('            maiden G3          trials G2          main G1')
  console.log('            spr mil med lng    spr mil med lng    spr mil med lng')
  for (const tier of TIERS_SAMPLED) {
    for (const stars of STARS) {
      const cells = (['maiden', 'trials', 'main'] as const).map((stage) =>
        (['sprint', 'mile', 'medium', 'long'] as const).map((category) => {
          const rate = bestWinRate(tier, stage, category, stars)
          if (stars === 5 && rate < FLOOR) {
            hardFailures += 1
            console.error(`FAIL T${tier} ${stage} ${category} at 5★: ${rate}%`)
          }
          return String(rate).padStart(3)
        }).join(' '))
      console.log(`T${String(tier).padStart(2)} ${stars}★    ${cells.join('    ')}`)
    }
  }
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} career check(s) failed`)
  process.exit(1)
}
