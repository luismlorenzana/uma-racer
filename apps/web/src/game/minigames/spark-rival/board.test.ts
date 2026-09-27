import { SPARK_RIVAL_BOARD_SIZE } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import {
  applySparkPath,
  createSparkRivalBoard,
  resolveSparkBoard,
  sparkMatchGroups,
} from './board'
import { sparkSeed } from './rng'
import { SPARK_ORBS, type SparkOrb } from './types'

const baseBoard = (): SparkOrb[] => Array.from(
  { length: SPARK_RIVAL_BOARD_SIZE },
  (_, index) => SPARK_ORBS[(Math.floor(index / 6) * 2 + index % 6) % SPARK_ORBS.length]!,
)

describe('Spark Rival board', () => {
  it('pins a match-free 6 × 5 starting board with five of every orb', () => {
    const first = createSparkRivalBoard(sparkSeed('fixed-seed-alpha', 'board'))
    const second = createSparkRivalBoard(sparkSeed('fixed-seed-alpha', 'board'))
    expect(first).toEqual(second)
    expect(first.board).toEqual([
      'spark', 'pace', 'end', 'late', 'spark', 'front',
      'spark', 'recovery', 'late', 'pace', 'recovery', 'end',
      'pace', 'front', 'spark', 'end', 'spark', 'late',
      'front', 'end', 'pace', 'pace', 'end', 'recovery',
      'late', 'front', 'recovery', 'late', 'front', 'recovery',
    ])
    expect(sparkMatchGroups(first.board)).toEqual([])
    expect(SPARK_ORBS.map((orb) => first.board.filter((cell) => cell === orb).length)).toEqual([5, 5, 5, 5, 5, 5])
  })

  it('finds 3/4/5+, simultaneous kinds, and one connected cross without mutating input', () => {
    const three = baseBoard(); three.splice(0, 3, 'front', 'front', 'front')
    const four = baseBoard(); four.splice(0, 4, 'pace', 'pace', 'pace', 'pace')
    const five = baseBoard(); five.splice(0, 5, 'late', 'late', 'late', 'late', 'late')
    const simultaneous = [...three]; simultaneous.splice(24, 3, 'end', 'end', 'end')
    const cross = baseBoard()
    cross[12] = 'front'
    cross[26] = 'front'
    for (const index of [8, 13, 14, 15, 20]) cross[index] = 'spark'
    const original = [...cross]
    expect(sparkMatchGroups(three)[0]?.indices).toHaveLength(3)
    expect(sparkMatchGroups(four)[0]?.indices).toHaveLength(4)
    expect(sparkMatchGroups(five)[0]?.indices).toHaveLength(5)
    expect(sparkMatchGroups(simultaneous).map((group) => group.orb)).toEqual(['front', 'end'])
    expect(sparkMatchGroups(cross)).toEqual([{ orb: 'spark', indices: [8, 13, 14, 15, 20] }])
    expect(cross).toEqual(original)
  })

  it('moves the held orb through orthogonal, diagonal, and revisited cells without mutating the board', () => {
    const board = baseBoard()
    const original = [...board]
    const result = applySparkPath(board, [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 2 },
      { row: 0, column: 1 },
    ])
    expect(result[0]).toBe(original[1])
    expect(result[1]).toBe(original[0])
    expect(result[8]).toBe(original[8])
    expect(board).toEqual(original)
  })

  it('resolves simultaneous clears and deterministic cascades without mutating the released board', () => {
    const board = baseBoard()
    board.splice(0, 3, 'front', 'front', 'front')
    board.splice(24, 3, 'end', 'end', 'end')
    const original = [...board]
    const first = resolveSparkBoard(board, 123_456)
    const second = resolveSparkBoard(board, 123_456)
    expect(first).toEqual(second)
    expect(first.cascades[0]?.groups.map((group) => group.orb)).toEqual(['front', 'end'])
    expect(first.cascades[0]?.cleared).toEqual([0, 1, 2, 24, 25, 26])
    expect(sparkMatchGroups(first.board)).toEqual([])
    expect(board).toEqual(original)
  })
})
