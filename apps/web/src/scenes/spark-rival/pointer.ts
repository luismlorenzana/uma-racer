// Deterministic pointer-to-board traversal for Spark Rival Circuit (docs/design/minigames.md#board-and-movement).
import { SPARK_RIVAL_BOARD_HEIGHT, SPARK_RIVAL_BOARD_WIDTH } from '@racer/domain'
import type { SparkCell } from '../../game/minigames/spark-rival'

export interface SparkBoardGeometry {
  left: number
  top: number
  cellSize: number
}

export function sparkCellAtPoint(x: number, y: number, geometry: SparkBoardGeometry): SparkCell | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(geometry.cellSize) || geometry.cellSize <= 0) return null
  const column = Math.floor((x - geometry.left) / geometry.cellSize)
  const row = Math.floor((y - geometry.top) / geometry.cellSize)
  if (column < 0 || column >= SPARK_RIVAL_BOARD_WIDTH || row < 0 || row >= SPARK_RIVAL_BOARD_HEIGHT) return null
  return { row, column }
}

/**
 * Supercover-style grid traversal. Every returned step is adjacent under the engine's eight-way rule, so skipped
 * browser samples can never create an invalid journal action. Ties advance diagonally to keep the traversal short.
 */
export function interpolateSparkCells(from: SparkCell, to: SparkCell): SparkCell[] {
  const cells: SparkCell[] = []
  let row = from.row
  let column = from.column
  const rowDistance = Math.abs(to.row - row)
  const columnDistance = Math.abs(to.column - column)
  const rowDirection = Math.sign(to.row - row)
  const columnDirection = Math.sign(to.column - column)
  const steps = Math.max(rowDistance, columnDistance)

  for (let step = 1; step <= steps; step += 1) {
    const nextRow = from.row + Math.round(step * rowDistance / steps) * rowDirection
    const nextColumn = from.column + Math.round(step * columnDistance / steps) * columnDirection
    if (nextRow !== row || nextColumn !== column) {
      row = nextRow
      column = nextColumn
      cells.push({ row, column })
    }
  }
  return cells
}

export function appendSparkPointerSample(path: readonly SparkCell[], sample: SparkCell, limit: number): SparkCell[] {
  const last = path.at(-1)
  if (!last) return [sample]
  if (last.row === sample.row && last.column === sample.column) return [...path]
  const room = Math.max(0, limit - path.length)
  return [...path, ...interpolateSparkCells(last, sample).slice(0, room)]
}
