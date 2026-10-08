import { describe, expect, it } from 'vitest'
import { STRATEGIES } from '../../types'
import { correctPuzzleElement, createPuzzleSource, eligiblePuzzleElements, eligiblePuzzleStyles, enrollPuzzleOutfit,
  enterFirstPuzzleBattle, parsePuzzleEnrollment, parsePuzzleSource } from './identity'
import { PUZZLE_ELEMENTS } from './types'
import { puzzleError, syntheticPuzzleSource } from './test-fixtures'

describe('literal A identity and versioned enrollment', () => {
  for (let mask = 0; mask < 16; mask++) {
    const styles = STRATEGIES.filter((_, i) => mask & (1 << i))
    it(`handles exact style set ${styles.join('+') || 'none'} before Dirt override`, () => {
      const source = syntheticPuzzleSource(styles), dirt = syntheticPuzzleSource(styles, true)
      const exact = styles.join(',')
      const expected = !styles.length ? [] : ['front', 'front,pace'].includes(exact) ? ['light'] :
        ['end', 'late,end'].includes(exact) ? ['dark'] : ['fire', 'water', 'wood']
      expect(eligiblePuzzleStyles(source)).toEqual(styles)
      expect(eligiblePuzzleElements(source)).toEqual(expected)
      expect(eligiblePuzzleElements(dirt)).toEqual(styles.length ? PUZZLE_ELEMENTS : [])
    })
  }
  it('does not treat S/B, racing defaults or improved grades as source A', () => {
    const source = syntheticPuzzleSource([])
    source.aptitudes.strategy.front = 'S'
    expect(eligiblePuzzleStyles(source)).toEqual([])
    expect(eligiblePuzzleElements(source)).toEqual([])
    puzzleError(() => enrollPuzzleOutfit(source, 'light'), 'locked')
    const original = syntheticPuzzleSource(['late'])
    const racingBuild = { strategy: 'front', grades: { ...original.aptitudes.strategy, front: 'A' } }
    expect(racingBuild.grades.front).toBe('A')
    expect(eligiblePuzzleElements(original)).toEqual(['fire', 'water', 'wood'])
    expect(eligiblePuzzleStyles(original)).toEqual(['late'])
  })
  it('normalizes explicit whole percentages once, without guessing mixed units', () => {
    const s = syntheticPuzzleSource()
    const raw = { id: s.templateId, baseStats: s.baseStats, aptitudes: s.aptitudes,
      growthRates: { speed: 20, stamina: 10, power: 0, guts: 30, wit: 5 } }
    expect(createPuzzleSource(raw, s.contentVersion, 'percent')).toEqual(s)
    puzzleError(() => createPuzzleSource(raw, s.contentVersion), 'invalid')
    puzzleError(() => createPuzzleSource({ ...raw, growthRates: { ...raw.growthRates, speed: 0.2 } }, s.contentVersion, 'percent'), 'invalid')
    expect(parsePuzzleSource({ ...s, growthRates: { ...s.growthRates, speed: NaN } })).toBeNull()
    expect(parsePuzzleSource({ ...s, growthRates: { ...s.growthRates, speed: Infinity } })).toBeNull()
  })
  it('deep-copies source inputs, freezes a valid palette and starts PL1/EXP0', () => {
    const source = syntheticPuzzleSource(['pace']), enrolled = enrollPuzzleOutfit(source, 'fire')
    source.baseStats.speed = 999
    source.aptitudes.strategy.front = 'A'
    expect(enrolled.source.baseStats.speed).toBe(101)
    expect(enrolled.source.aptitudes.strategy.front).toBe('B')
    expect(enrolled).toMatchObject({ schemaVersion: 1, level: 1, exp: 0, firstBattleId: null })
    expect(enrolled.eligibleElements).toEqual(['fire', 'water', 'wood'])
    expect(parsePuzzleEnrollment({ ...enrolled, eligibleElements: ['dark'] })).toBeNull()
    expect(parsePuzzleEnrollment({ ...enrolled, eligibleElements: ['fire', 'water', 'wood', 'wood'] })).toBeNull()
  })
  it('allows correction only until the first reservation, regardless of later loss/abandon', () => {
    const enrolled = enrollPuzzleOutfit(syntheticPuzzleSource(['pace'], true), 'fire')
    const corrected = correctPuzzleElement(enrolled, 'dark')
    expect(enrolled.element).toBe('fire')
    const entered = enterFirstPuzzleBattle(corrected, 'battle:1')
    puzzleError(() => correctPuzzleElement(entered, 'water'), 'locked')
    expect(enterFirstPuzzleBattle(entered, 'battle:2').firstBattleId).toBe('battle:1')
    puzzleError(() => correctPuzzleElement(enrollPuzzleOutfit(syntheticPuzzleSource(), 'light'), 'fire'), 'invalid')
  })
  it('rejects future schemas, extra keys, prototype tricks, oversized ids and malformed progress', () => {
    const source = syntheticPuzzleSource(), profile = enrollPuzzleOutfit(source, 'light')
    for (const v of [{ ...source, schemaVersion: 2 }, { ...source, rulesVersion: 2 }, { ...source, secret: 1 },
      { ...source, templateId: '__proto__' }, { ...source, contentVersion: 'a'.repeat(121) },
      Object.assign(Object.create({ malicious: true }), source), { ...source, baseStats: { ...source.baseStats, speed: -1 } }])
      expect(parsePuzzleSource(v)).toBeNull()
    for (const v of [{ ...profile, schemaVersion: 2 }, { ...profile, exp: 100 }, { ...profile, level: 1.2 },
      { ...profile, firstBattleId: 'prototype' }, { ...profile, eligibleElements: [null] }]) expect(parsePuzzleEnrollment(v)).toBeNull()
  })
})
