import { SPARK_RIVAL_MOVEMENT_MS, SPARK_RIVAL_PATH_LIMIT } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { SparkDragController } from './controller'

describe('Spark Rival drag controller', () => {
  it('allows unlimited planning before the first transition and times movement from that transition', () => {
    const controller = new SparkDragController()
    expect(controller.begin(7, { row: 0, column: 0 })).toBe(true)
    expect(controller.timeout(99_000)).toBeNull()
    expect(controller.move(7, { row: 0, column: 1 }, 100_000)).toEqual({ changed: true, resolveNow: false })
    expect(controller.release(7, 100_420)).toEqual({
      type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 420,
    })
  })

  it('ignores a second pointer and restores without an action on cancel', () => {
    const controller = new SparkDragController()
    expect(controller.begin(1, { row: 1, column: 1 })).toBe(true)
    expect(controller.begin(2, { row: 2, column: 2 })).toBe(false)
    expect(controller.move(2, { row: 2, column: 3 }, 1)).toEqual({ changed: false, resolveNow: false })
    expect(controller.cancel(2)).toBe(false)
    expect(controller.cancel(1)).toBe(true)
    expect(controller.snapshot).toBeNull()
  })

  it('resolves once at timeout and clamps movement duration', () => {
    const controller = new SparkDragController()
    controller.begin(1, { row: 0, column: 0 })
    controller.move(1, { row: 4, column: 5 }, 50)
    expect(controller.timeout(50 + SPARK_RIVAL_MOVEMENT_MS - 1)).toBeNull()
    expect(controller.timeout(50 + SPARK_RIVAL_MOVEMENT_MS)).toMatchObject({ movementMs: SPARK_RIVAL_MOVEMENT_MS })
    expect(controller.timeout(99_999)).toBeNull()
  })

  it('resolves immediately at the serialized path bound', () => {
    const controller = new SparkDragController()
    controller.begin(1, { row: 0, column: 0 })
    let resolveNow = false
    for (let sample = 0; sample < SPARK_RIVAL_PATH_LIMIT; sample += 1) {
      const moved = controller.move(1, { row: sample % 2, column: (sample >> 1) % 2 }, sample + 1)
      resolveNow ||= moved.resolveNow
    }
    expect(controller.snapshot?.path).toHaveLength(SPARK_RIVAL_PATH_LIMIT)
    expect(resolveNow).toBe(true)
  })
})
