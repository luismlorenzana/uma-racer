import { describe, expect, it } from 'vitest'
import { syntheticPuzzleBattle } from './battle-fixtures'
import type { PuzzleBattleAction, PuzzleBattleKind } from './battle-types'
import { puzzleIndexCell } from './board'
import { replayBattle, puzzleBattleResult } from './replay'

// Recorded literal actions/hashes: never regenerate expected fixtures using the reducer under test.
type RecordedAction = ['drag', number[], string] | ['active', number, string]
const journals: { seed: string; kind: PuzzleBattleKind; shape: 'basic' | 'starter-shaped'; level: number;
  actions: RecordedAction[]; hashes: string[]; drags: number; hp: number }[] = [
  { seed: 'journal-1', kind: 'ordinary', shape: 'basic', level: 5, drags: 5, hp: 3465,
    actions: [['drag', [15, 10, 4, 3, 8, 2], 'invented-foe-0'], ['drag', [16, 9, 15, 8, 13, 6], 'invented-foe-1'],
      ['drag', [2, 3, 10, 4, 9, 16], 'invented-foe-1'], ['drag', [1, 8, 3, 9, 10, 5], 'invented-foe-2'], ['drag', [2, 9, 14, 7, 12, 13], 'invented-foe-2']],
    hashes: ['c7de0445b4108ba5', 'ac1575cbf5f43857', '6063beddc442166d', '84c1cefb8cc8817b', '1f50e38fafb3be4b', 'b224220d6a696b11'] },
  { seed: 'sample-1', kind: 'champion', shape: 'starter-shaped', level: 2, drags: 7, hp: 2855,
    actions: [['drag', [3, 4, 9, 14, 19, 12], 'invented-foe-0'], ['drag', [0, 7, 8, 15, 9], 'invented-foe-0'],
      ['drag', [15, 21, 20, 13], 'invented-foe-0'], ['drag', [18, 25, 20, 27, 22, 29], 'invented-foe-0'],
      ['drag', [17, 10, 3, 2, 1], 'invented-foe-0'], ['active', 0, 'invented-foe-0'], ['drag', [0, 7, 14], 'invented-foe-0'],
      ['active', 1, 'invented-foe-0'], ['active', 2, 'invented-foe-0'], ['drag', [12, 7, 0, 1, 2, 9], 'invented-foe-0']],
    hashes: ['fc5b6ffc7794bb20', 'cdd34f32ddbb18be', 'a57647e792615ea7', 'd97eb2b19fae4211', '468e18ce92ecad26', '8f3fe37570a43b81',
      '2e63cb72890b33ce', '3a52c522f9adaa5e', '4f7eff88f08c605c', 'ef3c0a3835e92634', 'dc71832a5a2f1c42'] },
]
describe('complete fixed-seed v1 journal pins', () => {
  for (const journal of journals) it(`${journal.seed}: pins every intermediate state and JSON-roundtrip event sequence`, () => {
    const input = syntheticPuzzleBattle(journal.seed, journal.kind, journal.shape, journal.level)
    const actions: PuzzleBattleAction[] = journal.actions.map(a => a[0] === 'drag' ?
      { type: 'drag', path: a[1].map(puzzleIndexCell), focusId: a[2], elapsedMs: 0 } : { type: 'use-active', slot: a[1], focusId: a[2] })
    const replay = replayBattle(input, actions)
    expect(replay.hashes).toEqual(journal.hashes)
    expect(replayBattle(JSON.parse(JSON.stringify(input)), JSON.parse(JSON.stringify(actions)))).toEqual(replay)
    expect(puzzleBattleResult(replay.state)).toMatchObject({ outcome: 'win', drags: journal.drags, hpRemaining: journal.hp })
    if (journal.kind === 'champion') {
      const events = replay.steps.flatMap(s => s.events)
      for (const type of ['active', 'heal', 'phase', 'conversion', 'shield']) expect(events.some(e => e.type === type)).toBe(true)
      expect(actions.filter(a => a.type === 'drag').every(a => a.type === 'drag' && a.focusId !== null)).toBe(true)
    }
  })
})
