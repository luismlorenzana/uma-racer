// Engine v6 balance (docs/tasks/M021-turn-based-races.md#t070--balance-pnpm-simturns). Synthetic fields only.
//
//   pnpm sim:turns                     every target, 40 races per row
//   pnpm sim:turns -- 100              races per row
//   V6='{"speedCoef":0.004}' pnpm sim:turns   try a tuning change without editing the engine
//   PROFILE='{"long":{…}}' pnpm sim:turns      try rival distance profiles (D153) the same way
//
// Races are 12 runners of generated G1 rivals (D153) at tier 1 unless a row says otherwise.
import { NPC_PROFILE, mapStats, type Stats, type Strategy } from '../../packages/domain/src/index'
import { V6_TUNING, raceTurns, simulateRace, type RaceTimeline } from '../../packages/race/src/index'
import { NPC_KIT, rivalRunners, typicalCourse } from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 40)
// PROFILE='{"medium":{…}}' tries rival distance profiles without editing the domain.
if (process.env.PROFILE) Object.assign(NPC_PROFILE, JSON.parse(process.env.PROFILE))
console.log(`Engine v6 · ${RACES} races per row · tuning ${JSON.stringify(V6_TUNING)}`)

type Runner = ReturnType<typeof rivalRunners>[number]

function field(tier: number, distance: number, seed: number, player?: { stats: Stats; strategy: Strategy }): Runner[] {
  const gate = seed % 12
  const rivals = rivalRunners(tier, 'g1', distance, 12, gate, seed)
  const stats = player?.stats ?? rivals[0]!.stats
  const strategy = player?.strategy ?? rivals[0]!.strategy
  return [...rivals, { ...rivals[0]!, id: 'P', label: String(gate + 1), gate, stats, strategy }].sort((left, right) => left.gate - right.gate)
}

const fieldAverage = (runners: readonly Runner[]): Stats =>
  mapStats(runners[0]!.stats, (_, stat) => runners.reduce((sum, runner) => sum + runner.stats[stat], 0) / runners.length)

const midSpread = (timeline: RaceTimeline, share: number) => {
  const tick = Math.floor((timeline.ticks - 1) * share)
  const row = Array.from({ length: timeline.runnerCount }, (_, runner) => timeline.distance[tick * timeline.runnerCount + runner]!)
  return Math.max(...row) - Math.min(...row)
}

console.log('\nThe field (short % = runners without the HP for a full spurt; ran dry = HP hit zero, per race)')
console.log('distance turns  winner→last  spread@60%  overtakes  blocked s  short %  ran dry  wins F/P/L/E %')
for (const distance of [1200, 1600, 2000, 2400, 3000]) {
  let spread = 0; let mid = 0; let overtakes = 0; let blocked = 0; let dry = 0; let short = 0
  const wins: Record<Strategy, number> = { front: 0, pace: 0, late: 0, end: 0 }
  for (let seed = 1; seed <= RACES; seed += 1) {
    const runners = field(1, distance, seed)
    const timeline = simulateRace({ course: typicalCourse(distance), seed, runners })
    spread += timeline.results.at(-1)!.finishTime - timeline.results[0]!.finishTime
    mid += midSpread(timeline, 0.6)
    overtakes += timeline.events.filter((event) => event.type === 'overtake').length
    blocked += timeline.results.reduce((sum, result) => sum + (result.pack?.blockedSeconds ?? 0), 0) / timeline.runnerCount
    dry += timeline.events.filter((event) => event.type === 'hp-empty').length
    short += timeline.results.filter((result) => !result.spurtMaxed).length / timeline.runnerCount
    wins[runners[timeline.results[0]!.runner]!.strategy] += 1
  }
  const share = (strategy: Strategy) => String(Math.round((100 * wins[strategy]) / RACES)).padStart(3)
  console.log(`${String(distance).padStart(8)} ${String(raceTurns(distance)).padStart(5)}  ${(spread / RACES).toFixed(1).padStart(9)} s  ${(mid / RACES).toFixed(0).padStart(8)} m  ${(overtakes / RACES).toFixed(0).padStart(9)}  ${(blocked / RACES).toFixed(1).padStart(9)}  ${String(Math.round((100 * short) / RACES)).padStart(7)}  ${(dry / RACES).toFixed(1).padStart(7)}  ${share('front')}/${share('pace')}/${share('late')}/${share('end')}`)
}

console.log('\nStats — one runner at a multiple of the field average, 2,000 m: win rate and margin over the best rival')
for (const strategy of ['front', 'pace', 'late', 'end'] as Strategy[]) {
  const cells = [2, 1.2, 1.1, 1].map((multiple) => {
    let wins = 0; let gap = 0
    for (let seed = 1; seed <= RACES; seed += 1) {
      const average = fieldAverage(field(1, 2000, seed))
      const runners = field(1, 2000, seed, { stats: mapStats(average, (value) => value * multiple), strategy })
      const timeline = simulateRace({ course: typicalCourse(2000), seed, runners: runners.map((runner) => runner.id === 'P' ? { ...runner, skills: NPC_KIT } : runner) })
      const me = timeline.results.find((result) => result.id === 'P')!
      if (me.placement === 1) wins += 1
      gap += timeline.results.find((result) => result.id !== 'P')!.finishTime - me.finishTime
    }
    return `×${multiple} ${String(Math.round((100 * wins) / RACES)).padStart(3)}% ${(gap / RACES).toFixed(1).padStart(5)} s`
  })
  console.log(`${strategy.padEnd(5)}  ${cells.join('   ')}`)
}
