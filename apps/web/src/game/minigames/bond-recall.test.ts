import { describe, expect, it } from 'vitest'
import {
  bondMismatchesRemaining,
  bondRecallConfig,
  createBondLayout,
  flipBondTile,
  hideBondMismatch,
  selectBondFaces,
  startBondRecall,
  type BondRecallState,
} from './bond-recall'

const active = ['active-z', 'active-a']
const owned = ['owned-c', 'active-a', 'owned-a', 'owned-b', 'active-z']

function mismatchIndices(state: BondRecallState): [number, number] {
  const first = 0
  const second = state.tiles.findIndex((tile) => tile.pairId !== state.tiles[first]!.pairId)
  return [first, second]
}

describe('Bond Recall', () => {
  it('pins all four board configurations', () => {
    expect([0, 1, 2, 3].map(bondRecallConfig)).toEqual([
      { limitBreak: 0, pairs: 6, columns: 3, rows: 4, mismatchLimit: 10 },
      { limitBreak: 1, pairs: 8, columns: 4, rows: 4, mismatchLimit: 12 },
      { limitBreak: 2, pairs: 10, columns: 4, rows: 5, mismatchLimit: 14 },
      { limitBreak: 3, pairs: 12, columns: 4, rows: 6, mismatchLimit: 16 },
    ])
    expect(() => bondRecallConfig(4)).toThrow(/LB0 through LB3/)
  })

  it('prefers the active set, then owned ids, then repeats the full pool', () => {
    expect(selectBondFaces(active, owned, 8)).toEqual([
      'active-z', 'active-a', 'owned-a', 'owned-b', 'owned-c', 'active-z', 'active-a', 'owned-a',
    ])
    expect(selectBondFaces([], ['only-card'], 3)).toEqual(['only-card', 'only-card', 'only-card'])
  })

  it('pins a fixed seed layout and reproduces it exactly', () => {
    const first = createBondLayout('fixed-seed', 0, active, owned)
    const second = createBondLayout('fixed-seed', 0, active, owned)
    expect(first).toEqual(second)
    expect(first.map((tile) => `${tile.pairId}/${tile.cardId}`)).toEqual([
      'pair-2/owned-a',
      'pair-1/active-a',
      'pair-4/owned-c',
      'pair-3/owned-b',
      'pair-2/owned-a',
      'pair-0/active-z',
      'pair-5/active-z',
      'pair-1/active-a',
      'pair-4/owned-c',
      'pair-5/active-z',
      'pair-0/active-z',
      'pair-3/owned-b',
    ])
  })

  it('charges one mismatch while input is locked, then hides both faces', () => {
    const start = startBondRecall('mismatch-seed', 0, active, owned)
    const [first, second] = mismatchIndices(start)
    const one = flipBondTile(start, first).state
    const mismatch = flipBondTile(one, second).state
    expect(mismatch).toMatchObject({ status: 'resolving', mismatches: 1, revealed: [first, second] })
    expect(flipBondTile(mismatch, 3)).toEqual({ state: mismatch, accepted: false, result: 'ignored' })
    expect(mismatch.mismatches).toBe(1)
    expect(hideBondMismatch(mismatch)).toMatchObject({ status: 'playing', mismatches: 1, revealed: [] })
  })

  it('keeps a pair face up and wins after the final match', () => {
    let state = startBondRecall('winning-seed', 0, active, owned)
    for (const pairId of new Set(state.tiles.map((tile) => tile.pairId))) {
      const indices = state.tiles.flatMap((tile, index) => tile.pairId === pairId ? [index] : [])
      state = flipBondTile(state, indices[0]!).state
      state = flipBondTile(state, indices[1]!).state
    }
    expect(state).toMatchObject({ status: 'won', mismatches: 0, revealed: [] })
    expect(state.matched).toHaveLength(12)
  })

  it('ends the run when the mismatch budget is exhausted', () => {
    let state = startBondRecall('loss-seed', 0, active, owned)
    const [first, second] = mismatchIndices(state)
    for (let index = 0; index < state.config.mismatchLimit; index += 1) {
      state = flipBondTile(state, first).state
      state = flipBondTile(state, second).state
      if (state.status === 'resolving') state = hideBondMismatch(state)
    }
    expect(state).toMatchObject({ status: 'lost', mismatches: 10 })
    expect(bondMismatchesRemaining(state)).toBe(0)
    expect(flipBondTile(state, 3).accepted).toBe(false)
  })
})
