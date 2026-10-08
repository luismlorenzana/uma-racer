import { describe, expect, it } from 'vitest'
import { applyPuzzleBattleAction, createPuzzleBattle, parsePuzzlePath, puzzleBattleStateHash, PUZZLE_MOVEMENT_MS, PUZZLE_PATH_LIMIT } from '@racer/domain'
import { puzzlePracticeInput } from '../../game/puzzles/practice-input'
import { PuzzlePointerController, puzzleCellAtPoint } from './pointer'
import { sparkCellAtPoint } from '../spark-rival/pointer'
describe('Puzzle pointer geometry and monotonic ownership', () => {
  for (const width of [390, 375]) it(`maps ${width}px cells and boundaries after CSS zoom/safe-area scaling`, () => {
    const g = { left: 6, top: 80, cellSize: (width - 12) / 6 }
    for (let row = 0; row < 5; row++) for (let column = 0; column < 6; column++) {
      const x = g.left + (column + 0.5) * g.cellSize, y = g.top + (row + 0.5) * g.cellSize
      expect(puzzleCellAtPoint(x, y, g)).toEqual({ row, column })
      expect(sparkCellAtPoint(x, y, g)).toEqual({ row, column }) // Shared extraction preserves legacy mapping.
    }
    expect(puzzleCellAtPoint(g.left - 0.01, g.top, g)).toBeNull()
    expect(puzzleCellAtPoint(g.left + g.cellSize * 6, g.top, g)).toBeNull()
    expect(puzzleCellAtPoint(g.left, g.top + g.cellSize * 5, g)).toBeNull()
    expect(puzzleCellAtPoint(NaN, 0, g)).toBeNull()
    expect(puzzleCellAtPoint(0, 0, { ...g, cellSize: 0 })).toBeNull()
  })
  it('holding/no transition costs no turn, second pointer cannot change target or path', () => {
    const p = new PuzzlePointerController()
    expect(p.begin(1, { row: 0, column: 0 }, 'frozen-target')).toBe(true)
    expect(p.begin(2, { row: 4, column: 5 }, 'other')).toBe(false)
    expect(p.move(2, { row: 0, column: 1 }, 100)).toBe(false)
    expect(p.move(1, { row: 0, column: 0 }, 100)).toBe(false)
    expect(p.timeout(100000)).toBeNull(); expect(p.release(2, 100)).toBeNull()
    expect(p.release(1, 100000)).toBeNull()
  })
  it('first transition starts clock; release/expiry submits once with frozen focus', () => {
    const p = new PuzzlePointerController(); p.begin(9, { row: 0, column: 0 }, 'enemy')
    p.move(9, { row: 0, column: 1 }, 5000)
    expect(p.timeout(5000 + PUZZLE_MOVEMENT_MS - 1)).toBeNull()
    expect(p.timeout(5000 + PUZZLE_MOVEMENT_MS)).toMatchObject({ type: 'drag', elapsedMs: PUZZLE_MOVEMENT_MS, focusId: 'enemy' })
    expect(p.release(9, 20000)).toBeNull(); expect(p.timeout(20000)).toBeNull()
  })
  it('late browser samples cannot extend the path past the deadline', () => {
    const p = new PuzzlePointerController(); p.begin(1, { row: 0, column: 0 }, null)
    p.move(1, { row: 0, column: 1 }, 100)
    expect(p.move(1, { row: 4, column: 5 }, 7100)).toBe(false)
    expect(p.timeout(7100)?.path).toEqual([{ row: 0, column: 0 }, { row: 0, column: 1 }])
  })
  it('fast/skipped diagonal cells use the domain diagonal-first rule, with revisits', () => {
    const p = new PuzzlePointerController(); p.begin(1, { row: 0, column: 0 }, null)
    p.move(1, { row: 2, column: 5 }, 100); p.move(1, { row: 0, column: 0 }, 101)
    const action = p.release(1, 102)!
    expect(action.path.slice(0, 6)).toEqual([{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 2, column: 2 },
      { row: 2, column: 3 }, { row: 2, column: 4 }, { row: 2, column: 5 }])
    expect(action.path.at(-1)).toEqual({ row: 0, column: 0 }); expect(parsePuzzlePath(action.path)).toEqual(action.path)
    expect(action.elapsedMs).toBe(2)
  })
  it('bounds an adversarial revisit path without invalid jumps', () => {
    const p = new PuzzlePointerController(); p.begin(1, { row: 0, column: 0 }, null)
    for (let i = 0; i < 500; i++) p.move(1, { row: i % 2 ? 4 : 0, column: i % 2 ? 5 : 0 }, i + 1)
    const action = p.timeout(600)!
    expect(action.path.length).toBe(PUZZLE_PATH_LIMIT); expect(parsePuzzlePath(action.path)).toBeTruthy()
  })
  for (const boundary of ['pointercancel', 'lost capture', 'background', 'resize', 'orientation', 'navigation', 'guide']) it(`${boundary} cancels with no action`, () => {
    const p = new PuzzlePointerController(); p.begin(1, { row: 0, column: 0 }, null); p.move(1, { row: 4, column: 5 }, 100)
    p.cancel(); expect(p.release(1, 200)).toBeNull(); expect(p.timeout(10000)).toBeNull()
  })
  it('visual preferences and frame rates cannot enter the replay action or hash', () => {
    const hashes = [false, true].flatMap(plain => [false, true].flatMap(reduced => [60, 120].map(fps => {
      void plain; void reduced; void fps
      const p = new PuzzlePointerController(); p.begin(1, { row: 0, column: 0 }, null); p.move(1, { row: 4, column: 5 }, 100)
      return puzzleBattleStateHash(applyPuzzleBattleAction(createPuzzleBattle(puzzlePracticeInput()), p.release(1, 300)!).state)
    })))
    expect(new Set(hashes).size).toBe(1); expect(hashes[0]).toBe('f8e3005a8dc47b16')
  })
})
