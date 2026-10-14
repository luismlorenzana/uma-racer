// Pins the rework's time factor and its one conversion (D338).
import { describe, expect, it } from 'vitest'
import { secondsToMs, TIME_FACTOR, workSeconds } from './time'
import { isRefusal, refuse } from './types'

describe('rework time', () => {
  it('is k = 1.2 on whole seconds', () => {
    expect(TIME_FACTOR).toBe(1.2)
    expect(workSeconds(90)).toBe(6_480) // a grade-1 gather: 108 minutes
    expect(workSeconds(22.5)).toBe(1_620) // a grade-1 craft: 27 minutes
    expect(workSeconds(23.75)).toBe(1_710) // a grade-2 craft: 28.5 minutes
    expect(workSeconds(180)).toBe(12_960) // a grade-1 session: 216 minutes
    expect(workSeconds(315)).toBe(22_680)
  })

  it('divides by a building speed after rounding once', () => {
    expect(workSeconds(180, 1.25)).toBe(10_368)
    expect(workSeconds(22.5, 1.25)).toBe(1_296)
    expect(secondsToMs(workSeconds(90))).toBe(6_480_000)
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
