import { describe, expect, it } from 'vitest'
import {
  SPARK_RUN_MOVES,
  applySparkSwap,
  createSparkBoard,
  ensurePlayableSparkBoard,
  legalSparkMoves,
  playSparkMove,
  scoreSparkChain,
  sparkMatches,
  startSparkRun,
  type SparkMatchEvent,
  type SparkTile,
} from './spark-match'

const event = (length: number, tile: SparkTile = 0): SparkMatchEvent => ({
  tile,
  indices: Array.from({ length }, (_, index) => index),
})

describe('Spark Match', () => {
  it('pins a match-free, playable board and its first ten legal moves to one seed', () => {
    const expectedCells = [
      1, 1, 5, 0, 5, 2, 1,
      1, 3, 2, 2, 1, 5, 5,
      2, 1, 5, 2, 5, 2, 0,
      3, 4, 1, 4, 4, 3, 2,
      2, 1, 0, 5, 1, 2, 5,
      5, 5, 2, 5, 3, 0, 4,
      0, 5, 5, 2, 4, 3, 3,
      2, 0, 4, 1, 1, 2, 0,
    ]
    const expectedMoves = [
      { from: 4, to: 11 }, { from: 7, to: 8 }, { from: 11, to: 12 }, { from: 11, to: 18 },
      { from: 14, to: 15 }, { from: 22, to: 23 }, { from: 26, to: 27 }, { from: 35, to: 42 },
      { from: 37, to: 38 }, { from: 37, to: 44 },
    ]
    const first = createSparkBoard('fixed-seed-alpha')
    const second = createSparkBoard('fixed-seed-alpha')
    expect(first).toEqual(second)
    expect(first.cells).toEqual(expectedCells)
    expect(sparkMatches(first.cells)).toEqual([])
    expect(legalSparkMoves(first).slice(0, 10)).toEqual(expectedMoves)
  })

  it('pins 3, 4, 5+, trainee, and compounded cascade scoring', () => {
    expect(scoreSparkChain([{ matches: [event(3)], cascade: 0 }])).toBe(30)
    expect(scoreSparkChain([{ matches: [event(4)], cascade: 0 }])).toBe(60)
    expect(scoreSparkChain([{ matches: [event(5)], cascade: 0 }])).toBe(120)
    expect(scoreSparkChain([{ matches: [event(3, 5)], cascade: 0 }])).toBe(60)
    expect(scoreSparkChain([
      { matches: [event(3)], cascade: 0 },
      { matches: [event(4)], cascade: 1 },
    ])).toBe(108)
    expect(scoreSparkChain([
      { matches: [event(3)], cascade: 0 },
      { matches: [event(3)], cascade: 1 },
      { matches: [event(3)], cascade: 2 },
    ])).toBe(122)
  })

  it('resolves a fixed trainee match without mutating the starting board', () => {
    const board = createSparkBoard('fixed-seed-alpha')
    const before = [...board.cells]
    const result = applySparkSwap(board, 4, 11)
    expect(result).toMatchObject({ accepted: true, score: 60, reshuffled: false })
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]).toMatchObject({ cleared: [11, 12, 13], cascade: 0, rawPoints: 60 })
    expect(board.cells).toEqual(before)
    expect(result.board.cells).toEqual([
      1, 1, 5, 0, 1, 5, 5,
      1, 3, 2, 2, 1, 2, 1,
      2, 1, 5, 2, 5, 2, 0,
      3, 4, 1, 4, 4, 3, 2,
      2, 1, 0, 5, 1, 2, 5,
      5, 5, 2, 5, 3, 0, 4,
      0, 5, 5, 2, 4, 3, 3,
      2, 0, 4, 1, 1, 2, 0,
    ])
  })

  it('rejects a swap with no match without changing the board or move count', () => {
    const state = startSparkRun('fixed-seed-alpha')
    const result = playSparkMove(state, 0, 1)
    expect(result).toMatchObject({ accepted: false, score: 0, steps: [] })
    expect(result.state).toBe(state)
    expect(result.board).toBe(state.board)
  })

  it('reshuffles a match-free dead board deterministically instead of ending', () => {
    const cells = Array.from(
      { length: 56 },
      (_, index) => ((Math.floor(index / 7) + (index % 7) * 2) % 6) as SparkTile,
    )
    const dead = { cells, rngState: 123_456, reshuffles: 0 }
    expect(sparkMatches(cells)).toEqual([])
    expect(legalSparkMoves(dead)).toEqual([])
    const first = ensurePlayableSparkBoard(dead)
    const second = ensurePlayableSparkBoard(dead)
    expect(first).toEqual(second)
    expect(first.reshuffled).toBe(true)
    expect(first.board.reshuffles).toBe(1)
    expect(first.board.cells.slice(0, 7)).toEqual([5, 3, 3, 0, 1, 2, 0])
    expect(sparkMatches(first.board.cells)).toEqual([])
    expect(legalSparkMoves(first.board).length).toBeGreaterThan(0)
  })

  it('ends after exactly 25 accepted moves', () => {
    let state = startSparkRun('twenty-five-move-fixture')
    while (state.status === 'playing') {
      const move = legalSparkMoves(state.board)[0]
      expect(move).toBeDefined()
      state = playSparkMove(state, move!.from, move!.to).state
    }
    expect(state.moves).toBe(SPARK_RUN_MOVES)
    expect(state.score).toBeGreaterThan(0)
  })
})
