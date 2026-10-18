// Pins the rework's time factor and its one conversion (D338, D374).
import { describe, expect, it } from 'vitest'
import { secondsToMs, TIME_FACTOR, workSeconds } from './time'
import { isRefusal, refuse } from './types'

describe('rework time', () => {
  it('is k = 1.8 on whole seconds', () => {
    expect(TIME_FACTOR).toBe(1.8)
    expect(workSeconds(90)).toBe(9_720) // a grade-1 gather: 162 minutes
    expect(workSeconds(22.5)).toBe(2_430) // a grade-1 craft: 40.5 minutes
    expect(workSeconds(23.75)).toBe(2_565) // a grade-2 craft: 42.75 minutes
    expect(workSeconds(180)).toBe(19_440) // a grade-1 session: 324 minutes
    expect(workSeconds(315)).toBe(34_020)
  })

  it('divides by a building speed after rounding once', () => {
    expect(workSeconds(180, 1.25)).toBe(15_552)
    expect(workSeconds(22.5, 1.25)).toBe(1_944)
    expect(secondsToMs(workSeconds(90))).toBe(9_720_000)
  })

  it('refuses nonsense inputs', () => {
    expect(() => workSeconds(-1)).toThrow(RangeError)
    expect(() => workSeconds(Number.NaN)).toThrow(RangeError)
    expect(() => workSeconds(10, 0)).toThrow(RangeError)
  })

  it('builds refusals with plain words', () => {
    const refusal = refuse('quantity', 'Buy 1 to 99 at a time.')
    expect(isRefusal(refusal)).toBe(true)
    expect(isRefusal({ state: {}, receipt: {} })).toBe(false)
    expect(refuse('needs-first', 'Needs {unlock} first', { unlock: 'Speed grade 1' }).data).toEqual({ unlock: 'Speed grade 1' })
  })
})
