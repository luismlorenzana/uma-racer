// Monotonic single-pointer input; previews never mutate the journal (Uma Puzzles §5).
import { interpolatePuzzleCells, PUZZLE_BOARD_WIDTH, PUZZLE_BOARD_HEIGHT, PUZZLE_MOVEMENT_MS, PUZZLE_PATH_LIMIT,
  type PuzzleBattleAction, type PuzzleCell } from '@racer/domain'
import { cellAtPoint, type BoardGeometry } from '../puzzle-input/geometry'
export const puzzleCellAtPoint = (x: number, y: number, g: BoardGeometry) => cellAtPoint(x, y, g, PUZZLE_BOARD_WIDTH, PUZZLE_BOARD_HEIGHT)
export class PuzzlePointerController {
  current: { pointerId: number; path: PuzzleCell[]; startedAt: number | null; focusId: string | null } | null = null
  begin(pointerId: number, cell: PuzzleCell, focusId: string | null) {
    if (this.current) return false
    this.current = { pointerId, path: [{ ...cell }], startedAt: null, focusId }; return true
  }
  move(pointerId: number, cell: PuzzleCell, now: number) {
    const c = this.current
    if (!c || c.pointerId !== pointerId) return false
    if (c.startedAt !== null && now - c.startedAt >= PUZZLE_MOVEMENT_MS) return false
    const extra = interpolatePuzzleCells(c.path.at(-1)!, cell).slice(1, 1 + PUZZLE_PATH_LIMIT - c.path.length)
    if (!extra.length) return false
    c.path.push(...extra); c.startedAt ??= now; return true
  }
  release(pointerId: number, now: number): Extract<PuzzleBattleAction, { type: 'drag' }> | null {
    const c = this.current
    if (!c || c.pointerId !== pointerId) return null
    this.current = null
    if (c.startedAt === null || c.path.length < 2) return null
    return { type: 'drag', path: c.path, focusId: c.focusId,
      elapsedMs: Math.max(1, Math.min(PUZZLE_MOVEMENT_MS, Math.round(now - c.startedAt))) }
  }
  timeout(now: number) {
    const c = this.current
    return c?.startedAt !== null && c && (now - c.startedAt >= PUZZLE_MOVEMENT_MS || c.path.length >= PUZZLE_PATH_LIMIT)
      ? this.release(c.pointerId, Math.min(now, c.startedAt + PUZZLE_MOVEMENT_MS)) : null
  }
  cancel(pointerId?: number) { if (pointerId === undefined || this.current?.pointerId === pointerId) this.current = null }
}
