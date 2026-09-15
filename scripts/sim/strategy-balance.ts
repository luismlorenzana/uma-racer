// Headless balance run: identical baseline enemy fields across tiers, distances, and stat scales.
// Reports HP exhaustion, maxed spurts, and win share by strategy. Findings: docs/research/race-engine-r1-findings.md
//
//   pnpm sim:balance            (200 races per row)
//   pnpm sim:balance -- 1000    (more races per row)
import { npcRaceStats, distanceCategory, STRATEGIES, type RaceGrade } from '../../packages/domain/src/index'
import { simulateRace } from '../../packages/race/src/index'

const RACES_PER_ROW = Number(process.argv[2] ?? 200)
const FIELD = 12
const GRADE: RaceGrade = 'g1'
const ROWS: [tier: number, distance: number][] = [
  [1, 1200],
  [1, 1600],
  [1, 2400],
  [1, 3200],
  [6, 2400],
  [11, 3200],
]
/** Uma Level 1 (field Form 80%) and 10 (field Form 89%). */
const LEVELS = [1, 10]

console.log(`${RACES_PER_ROW} races per row · ${FIELD} runners · ${GRADE} · strategies rotate by gate\n`)
console.log('tier  dist  level  stamina  hp-empty  maxed  wins front/pace/late/end   win time')
for (const [tier, distance] of ROWS) {
  for (const level of LEVELS) {
    const stats = npcRaceStats(tier, GRADE, distanceCategory(distance), level)
    const runners = Array.from({ length: FIELD }, (_, gate) => ({
      id: `n${gate}`,
      label: `${gate + 1}`,
      stats,
      strategy: STRATEGIES[gate % 4]!,
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      gate,
    }))
    const wins = { front: 0, pace: 0, late: 0, end: 0 }
    let empty = 0
    let maxed = 0
    let winTime = 0
    for (let seed = 1; seed <= RACES_PER_ROW; seed++) {
      const t = simulateRace({ course: { distance, surface: 'turf' }, seed, runners })
      wins[runners[t.results[0]!.runner]!.strategy]++
      empty += t.events.filter((e) => e.type === 'hp-empty').length
      maxed += t.results.filter((r) => r.spurtMaxed).length
      winTime += t.results[0]!.finishTime
    }
    const pct = (n: number) => `${Math.round((n / (RACES_PER_ROW * FIELD)) * 100)}%`.padStart(5)
    console.log(
      `${String(tier).padStart(4)}  ${String(distance).padStart(4)}  ${String(level).padStart(5)}  ${String(Math.round(stats.stamina)).padStart(7)}  ${pct(empty).padStart(8)}  ${pct(maxed)}  ${[wins.front, wins.pace, wins.late, wins.end].map((w) => String(w).padStart(4)).join(' / ')}   ${(winTime / RACES_PER_ROW).toFixed(1)}s`,
    )
  }
}
