import { describe, expect, it } from 'vitest'
import { applyPuzzlePath, convertPuzzleBoard, createPuzzleBoard, interpolatePuzzleCells, parsePuzzleBoard, parsePuzzlePath,
  puzzleMatchGroups, refillPuzzleBoard, resolvePuzzleBoard, PUZZLE_ORBS, type PuzzleOrb } from './board'
import { createPuzzleRng, puzzleNextInt } from './rng'
import { puzzleError } from './test-fixtures'

const stable = (): PuzzleOrb[] => Array.from({ length: 30 }, (_, i) => PUZZLE_ORBS[(Math.floor(i / 6) + i % 6) % 6]!)
describe('independent deterministic 6×5 Puzzle board', () => {
  it('makes a match-free five-of-each opening, repeatably across fixed seeds', () => {
    for (const seed of ['one', 'two', 'three', 'four', 'five']) {
      const rng = createPuzzleRng(seed), result = createPuzzleBoard(rng.opening)
      expect(result).toEqual(createPuzzleBoard(rng.opening))
      expect(puzzleMatchGroups(result.board)).toEqual([])
      for (const orb of PUZZLE_ORBS) expect(result.board.filter(o => o === orb)).toHaveLength(5)
    }
  })
  it('unions a cross once, but excludes touching non-qualifying tails', () => {
    const board: PuzzleOrb[] = stable().map(orb => orb === 'fire' ? 'light' : orb)
    for (const i of [7, 12, 13, 14, 19, 15]) board[i] = 'fire'
    // 12…15 is a qualifying line; 7,13,19 is a qualifying column. 20 only touches it.
    board[20] = 'fire'
    expect(puzzleMatchGroups(board).find(g => g.orb === 'fire')).toEqual({ orb: 'fire', indices: [7, 12, 13, 14, 15, 19] })
  })
  it('keeps disjoint same-colour threes separate and orders groups by first cell', () => {
    const board = stable()
    for (const i of [0, 1, 2, 27, 28, 29]) board[i] = 'dark'
    expect(puzzleMatchGroups(board).filter(g => g.orb === 'dark')).toEqual([
      { orb: 'dark', indices: [0, 1, 2] }, { orb: 'dark', indices: [27, 28, 29] },
    ])
  })
  it('orders gravity column-first, bottom-first and refills remaining cells deterministically', () => {
    const board = stable(), result = refillPuzzleBoard(board, [0, 12], createPuzzleRng('gravity').refill)
    expect(result.falls).toEqual([{ from: 6, to: 12, orb: board[6] }])
    expect(result.refills.map(r => r.index)).toEqual([6, 0])
    expect(result.board[24]).toBe(board[24]); expect(result.board[18]).toBe(board[18]); expect(result.board[12]).toBe(board[6])
    expect(result).toEqual(refillPuzzleBoard(board, [12, 0], createPuzzleRng('gravity').refill))
  })
  it('clears simultaneously, retains every cascade and finishes stable', () => {
    const result = resolvePuzzleBoard(Array<PuzzleOrb>(30).fill('fire'), createPuzzleRng('cascade-1').refill)
    expect(result.cascades[0]!.cleared).toEqual(Array.from({ length: 30 }, (_, i) => i))
    expect(result.cascades[0]!.groups).toEqual([{ orb: 'fire', indices: Array.from({ length: 30 }, (_, i) => i) }])
    expect(result.cascades.length).toBeGreaterThan(1)
    result.cascades.forEach((c, i) => { expect(c.index).toBe(i); if (i) expect(c.before).toEqual(result.cascades[i - 1]!.after) })
    expect(puzzleMatchGroups(result.board)).toEqual([])
    expect(result).toEqual(resolvePuzzleBoard(Array<PuzzleOrb>(30).fill('fire'), createPuzzleRng('cascade-1').refill))
  })
  it('accepts orthogonal/diagonal revisits and deterministically interpolates skipped cells', () => {
    const path = [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 0, column: 0 }]
    expect(parsePuzzlePath(path)).toEqual(path); expect(applyPuzzlePath(stable(), path)).toEqual(stable())
    expect(interpolatePuzzleCells({ row: 0, column: 0 }, { row: 2, column: 4 })).toEqual([
      { row: 0, column: 0 }, { row: 1, column: 1 }, { row: 2, column: 2 }, { row: 2, column: 3 }, { row: 2, column: 4 },
    ])
    expect(interpolatePuzzleCells(path[0]!, path[0]!)).toHaveLength(1)
  })
  it('rejects no-transition release, jumps, repeated cell, NaN and oversized paths', () => {
    for (const path of [[], [{ row: 0, column: 0 }], [{ row: 0, column: 0 }, { row: 4, column: 0 }],
      [{ row: 0, column: 0 }, { row: 0, column: 0 }], [{ row: NaN, column: 0 }, { row: 0, column: 0 }],
      Array.from({ length: 257 }, (_, i) => ({ row: 0, column: i % 2 }))]) expect(parsePuzzlePath(path)).toBeNull()
    expect(parsePuzzleBoard([...stable(), 'fire'])).toBeNull()
    puzzleError(() => refillPuzzleBoard(stable(), [1, 1], 1), 'invalid')
  })
  it('converts on its own stream without resolving matches or consuming other streams', () => {
    const rng = createPuzzleRng('streams'), original = { ...rng }, board = stable()
    const converted = convertPuzzleBoard(board, [0, 1, 2, 3, 4], 'dark', 5, rng.playerConversion)
    rng.playerConversion = converted.state
    expect(puzzleMatchGroups(converted.board).length).toBeGreaterThan(0)
    expect(rng.opening).toBe(original.opening); expect(rng.refill).toBe(original.refill); expect(rng.enemyConversion).toBe(original.enemyConversion)
    expect(new Set(Object.values(original)).size).toBe(4)
    expect(puzzleNextInt(original.refill, 6)).toEqual(puzzleNextInt(rng.refill, 6))
    expect(converted.indices).toEqual([0, 1, 2, 3, 4])
  })
})
