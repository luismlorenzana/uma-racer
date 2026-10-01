// Engine v8 balance (docs/design/racing.md, D158, D231). Synthetic fields only.
//
//   pnpm sim:turns                     every target, 40 races per row
//   pnpm sim:turns -- 100              races per row
//   V8='{"railDrift":0.5}' pnpm sim:turns   try a tuning change without editing the engine
//   PROFILE='{"long":{…}}' pnpm sim:turns      try rival distance profiles (D153) the same way
//
// Races are 12 runners of generated G1 rivals (D153) at tier 1 unless a row says otherwise.
import { NPC_PROFILE, mapStats, type Stats, type Strategy } from '../../packages/domain/src/index'
import { SPURT_BUFFER_METERS, V8_TUNING, raceTurns, simulateRace as simulateCurrent, simulateRaceV7, type RaceTimeline } from '../../packages/race/src/index'

// ENGINE=7 pnpm sim:turns compares against the frozen engine v7 on the same fields and courses.
const simulateRace = process.env.ENGINE === '7' ? simulateRaceV7 : simulateCurrent
import { NPC_KIT, PLAYER_KIT, rivalRunners, skill, typicalCourse } from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 40)
// PROFILE='{"medium":{…}}' tries rival distance profiles without editing the domain.
if (process.env.PROFILE) Object.assign(NPC_PROFILE, JSON.parse(process.env.PROFILE))
console.log(`Engine v${process.env.ENGINE === '7' ? 7 : 8} · ${RACES} races per row · tuning ${JSON.stringify(V8_TUNING)}`)

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

console.log('\nThe field (short % = runners without the HP for a full spurt; ran dry = HP hit zero before the last 60 m, per race)')
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
    // The spurt plan leaves the last 60 m out, as the original's does, so running dry inside them is by design.
    dry += timeline.events.filter((event) => event.type === 'hp-empty' &&
      timeline.distance[event.tick * timeline.runnerCount + event.runner]! < distance - SPURT_BUFFER_METERS).length
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
      const timeline = simulateRace({ course: typicalCourse(2000), seed, runners })
      const me = timeline.results.find((result) => result.id === 'P')!
      if (me.placement === 1) wins += 1
      gap += timeline.results.find((result) => result.id !== 'P')!.finishTime - me.finishTime
    }
    return `×${multiple} ${String(Math.round((100 * wins) / RACES)).padStart(3)}% ${(gap / RACES).toFixed(1).padStart(5)} s`
  })
  console.log(`${strategy.padEnd(5)}  ${cells.join('   ')}`)
}

// --- Engine v7 (D158): skills against Speed, every stat, and a real build -------------------------------------------

const even = (value: number): Stats => ({ speed: value, stamina: value, power: value, guts: value, wit: value })
const test = (gate: number, stats: Stats, strategy: Strategy, skills: Runner['skills'] = []): Runner =>
  ({ id: `t${gate}`, label: String(gate + 1), gate, stats, strategy, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills })
const STYLES: Strategy[] = ['front', 'pace', 'late', 'end']

console.log('\nSkills against Speed, 2,000 m: 1,000 Speed with a Lv5 unique, a gold speed, a gold acceleration and two whites')
console.log('(all firing) against 1,400 Speed with none; every other stat 800, in a field of 800s. Share she finishes ahead')
const KIT = [
  skill('unique', 'phase_random==2', 'target-speed', 0.35 * 1.1, 5, 'guaranteed'),
  skill('gold-speed', 'is_finalcorner==1', 'target-speed', 0.35, 3, 'guaranteed'),
  skill('gold-acceleration', 'phase==2', 'acceleration', 0.4, 3, 'guaranteed'),
  skill('white-speed', 'phase==1', 'target-speed', 0.15, 3, 'guaranteed'),
  skill('white-acceleration', 'is_lastspurt==1', 'acceleration', 0.2, 3, 'guaranteed'),
]
console.log(STYLES.map((style) => {
  let ahead = 0; let gap = 0
  for (let seed = 1; seed <= RACES; seed += 1) {
    const runners = Array.from({ length: 12 }, (_, gate) => gate === 0 ? test(0, { ...even(800), speed: 1400 }, style)
      : gate === 1 ? test(1, { ...even(800), speed: 1000 }, style, KIT) : test(gate, even(800), STYLES[gate % 4]!, NPC_KIT))
    const results = simulateRace({ course: typicalCourse(2000), seed, runners }).results
    const fast = results.find((result) => result.runner === 0)!
    const skilled = results.find((result) => result.runner === 1)!
    if (skilled.placement < fast.placement) ahead += 1
    gap += fast.finishTime - skilled.finishTime
  }
  return `${style} ${Math.round((100 * ahead) / RACES)}% by ${(gap / RACES).toFixed(2)} s`
}).join('   '))

console.log('\nEvery stat, 2,400 m: a pace runner with 300 more of one stat than a field of 800s — average place (12 runners)')
const place = (stat?: keyof Stats) => {
  let total = 0
  for (let seed = 1; seed <= RACES; seed += 1) {
    const runners = Array.from({ length: 12 }, (_, gate) =>
      test(gate, gate === 0 && stat ? { ...even(800), [stat]: 1100 } : even(800), gate === 0 ? 'pace' : STYLES[gate % 4]!, NPC_KIT))
    total += simulateRace({ course: typicalCourse(2400), seed, runners }).results.find((result) => result.runner === 0)!.placement
  }
  return (total / RACES).toFixed(1)
}
console.log(`none ${place()}   ${(['speed', 'stamina', 'power', 'guts', 'wit'] as const).map((stat) => `${stat} ${place(stat)}`).join('   ')}`)

console.log('\nA real TL10 build (989 / 617 / 567 / 616 / 691, the owner\'s Special Week) with her unique and a few golds,')
console.log('against tier-1 fields: win rate, best of four styles')
const OWNER: Stats = { speed: 989, stamina: 617, power: 567, guts: 616, wit: 691 }
for (const distance of [1600, 2000, 2400]) {
  const cells = (['g3', 'g2', 'g1'] as const).map((grade) => {
    const best = Math.max(...STYLES.map((strategy) => {
      let wins = 0
      for (let seed = 1; seed <= RACES; seed += 1) {
        const gate = seed % 12
        const runners = [...rivalRunners(1, grade, distance, 12, gate, seed), { ...test(gate, OWNER, strategy, PLAYER_KIT), id: 'P' }]
          .sort((left, right) => left.gate - right.gate)
        if (simulateRace({ course: typicalCourse(distance), seed, runners }).results[0]!.id === 'P') wins += 1
      }
      return wins
    }))
    return `${grade.toUpperCase()} ${String(Math.round((100 * best) / RACES)).padStart(3)}%`
  })
  console.log(`${String(distance).padStart(5)} m  ${cells.join('   ')}`)
}
