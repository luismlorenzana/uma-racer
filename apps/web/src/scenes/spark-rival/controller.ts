// Browser-independent drag lifecycle for the Spark Rival touch scene (docs/design/minigames.md#presentation-and-touch).
import { SPARK_RIVAL_MOVEMENT_MS, SPARK_RIVAL_PATH_LIMIT } from '@racer/domain'
import type { SparkCell, SparkRivalAction } from '../../game/minigames/spark-rival'
import { appendSparkPointerSample } from './pointer'

export interface SparkDragSnapshot {
  pointerId: number
  path: readonly SparkCell[]
  movementStartedAt: number | null
}

export class SparkDragController {
  private active: SparkDragSnapshot | null = null

  get snapshot(): SparkDragSnapshot | null {
    return this.active
  }

  begin(pointerId: number, cell: SparkCell): boolean {
    if (this.active) return false
    this.active = { pointerId, path: [cell], movementStartedAt: null }
    return true
  }

  move(pointerId: number, cell: SparkCell, now: number): { changed: boolean; resolveNow: boolean } {
    if (!this.active || this.active.pointerId !== pointerId) return { changed: false, resolveNow: false }
    const path = appendSparkPointerSample(this.active.path, cell, SPARK_RIVAL_PATH_LIMIT)
    const changed = path.length !== this.active.path.length
    if (!changed) return { changed: false, resolveNow: false }
    this.active = {
      ...this.active,
      path,
      movementStartedAt: this.active.movementStartedAt ?? now,
    }
    return { changed: true, resolveNow: path.length >= SPARK_RIVAL_PATH_LIMIT }
  }

  release(pointerId: number, now: number): SparkRivalAction | null {
    if (!this.active || this.active.pointerId !== pointerId) return null
    const drag = this.active
    this.active = null
    if (drag.path.length < 2 || drag.movementStartedAt === null) return null
    return {
      type: 'drag',
      path: drag.path,
      movementMs: Math.max(1, Math.min(SPARK_RIVAL_MOVEMENT_MS, Math.round(now - drag.movementStartedAt))),
    }
  }

  timeout(now: number): SparkRivalAction | null {
    const drag = this.active
    if (!drag || drag.movementStartedAt === null || now - drag.movementStartedAt < SPARK_RIVAL_MOVEMENT_MS) return null
    return this.release(drag.pointerId, drag.movementStartedAt + SPARK_RIVAL_MOVEMENT_MS)
  }

  cancel(pointerId?: number): boolean {
    if (!this.active || (pointerId !== undefined && this.active.pointerId !== pointerId)) return false
    this.active = null
    return true
  }
}
