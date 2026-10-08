import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPuzzleBoard, resolvePuzzleBoard } from './board'
import * as rng from './rng'
import { puzzleError } from './test-fixtures'

afterEach(() => vi.restoreAllMocks())
describe('bounded board failure is recoverable, never a truncated successful board', () => {
  it('errors after 64 non-terminating cascades without mutating its input', () => {
    vi.spyOn(rng, 'puzzleNextInt').mockReturnValue([0, 1])
    const board = Array(30).fill('fire')
    puzzleError(() => resolvePuzzleBoard(board, 1), 'overflow')
    expect(board).toEqual(Array(30).fill('fire'))
  })
  it('errors on exhausted opening retries rather than accepting an opening match', () => {
    vi.spyOn(rng, 'puzzleShuffle').mockImplementation((values, state) => ({ values: [...values], state }))
    puzzleError(() => createPuzzleBoard(1), 'overflow')
  })
})
