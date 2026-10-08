// Shared pointer geometry only; each game's traversal and rules stay independent.
export interface BoardGeometry { left: number; top: number; cellSize: number }
export function cellAtPoint(x: number, y: number, geometry: BoardGeometry, width: number, height: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(geometry.cellSize) || geometry.cellSize <= 0) return null
  const column = Math.floor((x - geometry.left) / geometry.cellSize), row = Math.floor((y - geometry.top) / geometry.cellSize)
  return column < 0 || column >= width || row < 0 || row >= height ? null : { row, column }
}
