import { SPARK_RIVAL_PATH_LIMIT } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { appendSparkPointerSample, interpolateSparkCells, sparkCellAtPoint } from './pointer'

describe('Spark Rival pointer traversal', () => {
  it('expands horizontal, vertical, diagonal, and uneven skipped samples deterministically', () => {
    expect(interpolateSparkCells({ row: 2, column: 0 }, { row: 2, column: 5 })).toEqual([
      { row: 2, column: 1 }, { row: 2, column: 2 }, { row: 2, column: 3 }, { row: 2, column: 4 }, { row: 2, column: 5 },
    ])
    expect(interpolateSparkCells({ row: 4, column: 3 }, { row: 0, column: 3 })).toEqual([
      { row: 3, column: 3 }, { row: 2, column: 3 }, { row: 1, column: 3 }, { row: 0, column: 3 },
    ])
    expect(interpolateSparkCells({ row: 0, column: 0 }, { row: 4, column: 4 })).toEqual([
      { row: 1, column: 1 }, { row: 2, column: 2 }, { row: 3, column: 3 }, { row: 4, column: 4 },
    ])
    expect(interpolateSparkCells({ row: 0, column: 0 }, { row: 2, column: 5 })).toEqual([
      { row: 0, column: 1 }, { row: 1, column: 2 }, { row: 1, column: 3 }, { row: 2, column: 4 }, { row: 2, column: 5 },
    ])
  })

  it('maps points at the board edges and rejects points outside', () => {
    const geometry = { left: 10, top: 20, cellSize: 50 }
    expect(sparkCellAtPoint(10, 20, geometry)).toEqual({ row: 0, column: 0 })
    expect(sparkCellAtPoint(309.9, 269.9, geometry)).toEqual({ row: 4, column: 5 })
    expect(sparkCellAtPoint(310, 270, geometry)).toBeNull()
    expect(sparkCellAtPoint(9.9, 20, geometry)).toBeNull()
  })

  it('deduplicates repeated samples and clamps a large stream at the serialized path limit', () => {
    let path = [{ row: 0, column: 0 }]
    path = appendSparkPointerSample(path, { row: 0, column: 0 }, SPARK_RIVAL_PATH_LIMIT)
    expect(path).toHaveLength(1)
    for (let index = 0; index < 100; index += 1) {
      path = appendSparkPointerSample(path, { row: index % 5, column: index % 6 }, SPARK_RIVAL_PATH_LIMIT)
    }
    expect(path.length).toBeLessThanOrEqual(SPARK_RIVAL_PATH_LIMIT)
    for (let index = 1; index < path.length; index += 1) {
      expect(Math.abs(path[index]!.row - path[index - 1]!.row)).toBeLessThanOrEqual(1)
      expect(Math.abs(path[index]!.column - path[index - 1]!.column)).toBeLessThanOrEqual(1)
      expect(path[index]).not.toEqual(path[index - 1])
    }
  })
})
