import { describe, expect, it } from 'vitest'
import { SPARK_ORB_COLORS, SPARK_ORB_GLYPHS, SPARK_ORB_PIXI_COLORS } from './spark-rival-presentation'

describe('Spark Rival presentation', () => {
  it('keeps every orb colour distinct and End silver beside green Recovery', () => {
    expect(new Set(Object.values(SPARK_ORB_COLORS)).size).toBe(6)
    expect(SPARK_ORB_COLORS.end).toBe('#a8b6c6')
    expect(SPARK_ORB_COLORS.recovery).toBe('#58bf70')
    expect(SPARK_ORB_PIXI_COLORS.end).toBe(0xa8b6c6)
    expect(SPARK_ORB_GLYPHS.end).toBe('E')
  })
})
