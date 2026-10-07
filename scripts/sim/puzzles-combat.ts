// T107 modest invented engine-only sample. T108 owns chapter/economy scaling; no private content read.
import assert from 'node:assert/strict'
import { applyBattleAction, createBattle } from '../../packages/domain/src/minigames/uma-puzzles/battle'
import { syntheticPuzzleBattle, PUZZLE_SYNTHETIC_PARTIES } from '../../packages/domain/src/minigames/uma-puzzles/battle-fixtures'
import { puzzleBotAction, type PuzzleBot } from '../../packages/domain/src/minigames/uma-puzzles/bots'
import type { PuzzleBattleKind } from '../../packages/domain/src/minigames/uma-puzzles/battle-types'
import { PUZZLE_ACTION_LIMIT } from '../../packages/domain/src/minigames/uma-puzzles/battle-rules'
import { battleStateHash, replayBattle } from '../../packages/domain/src/minigames/uma-puzzles/replay'

const seeds = ['sample-1', 'sample-2', 'sample-3', 'sample-4']
// [clears, median drags, median HP rounded to tenths of a percent, Heart groups, active uses], 16 battles/row.
// Recorded baseline, not balance closure. A deliberate engine change must review this envelope and journal pins.
const expected = [
  [1, 6, 0, 31, 0], [2, 6.5, 0, 32, 0], [8, 8.5, 50, 35, 0],
  [0, 12, 0, 44, 0], [6, 12, 0, 44, 0], [12, 13, 292, 43, 0],
  [0, 12, 0, 47, 0], [0, 16.5, 0, 55, 0], [2, 17, 0, 54, 0],
  [16, 6, 705, 39, 16], [16, 4, 1000, 34, 3], [16, 4, 1000, 29, 2],
  [16, 6, 786, 43, 25], [16, 5, 970, 36, 7], [16, 4, 1000, 31, 2],
  [16, 8.5, 740, 69, 65], [16, 6.5, 862, 45, 33], [16, 6, 1000, 43, 22],
]
let row = 0
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}
console.log('Synthetic Puzzle v1: 288 battles, four seeds × four parties × three PLs × three kinds × two public-action bots.')
console.log('Not production balance. Low/on/high PL = 2/5/8 at encounter PL5. End HP includes losses; Hearts counts matched groups.')
console.log('bot / kind / PL   clears  median drags  median end HP  Hearts/battle  actives/battle  reasons')
for (const bot of ['novice', 'competent'] as PuzzleBot[]) for (const kind of ['ordinary', 'guardian', 'champion'] as PuzzleBattleKind[])
  for (const level of [2, 5, 8]) {
    const drags: number[] = [], hp: number[] = [], reasons: Record<string, number> = {}
    let clears = 0, hearts = 0, actives = 0
    for (const party of PUZZLE_SYNTHETIC_PARTIES) for (const seed of seeds) {
      const input = syntheticPuzzleBattle(seed, kind, party, level), actions = [], hashes: string[] = []
      let state = createBattle(input)
      while (state.outcome === 'active') {
        assert(actions.length < PUZZLE_ACTION_LIMIT)
        const action = puzzleBotAction(state, bot), step = applyBattleAction(state, action)
        actions.push(action); state = step.state; hashes.push(battleStateHash(state))
        for (const event of step.events) {
          if (event.type === 'active') actives++
          if (event.type === 'cascade') hearts += event.cascade.groups.filter(g => g.orb === 'heart').length
        }
      }
      const replay = replayBattle(JSON.parse(JSON.stringify(input)), JSON.parse(JSON.stringify(actions)))
      assert.deepEqual(replay.hashes.slice(1), hashes)
      clears += Number(state.outcome === 'win'); drags.push(state.turn); hp.push(100 * state.hp / state.maxHp)
      reasons[state.reason!] = (reasons[state.reason!] ?? 0) + 1
    }
    assert.equal(drags.length, 16)
    // Structural envelope, not a false 85–95% balance-closure assertion on invented fixtures.
    assert(drags.every(n => n >= 1 && n <= 30)); assert(hp.every(n => n >= 0 && n <= 100))
    assert.deepEqual([clears, median(drags), Math.round(median(hp) * 10), hearts, actives], expected[row++], 'Synthetic sim envelope drift')
    console.log(`${bot.padEnd(9)} ${kind.padEnd(8)} PL${level}  ${(100 * clears / 16).toFixed(1).padStart(5)}%  ${median(drags).toFixed(1).padStart(7)}  ${median(hp).toFixed(1).padStart(10)}%  ${(hearts / 16).toFixed(2).padStart(8)}  ${(actives / 16).toFixed(2).padStart(8)}  ${JSON.stringify(reasons)}`)
  }
console.log('PASS: all terminal bounds and every intermediate JSON-roundtrip replay hash match.')
