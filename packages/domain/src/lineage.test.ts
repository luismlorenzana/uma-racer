import { describe, expect, it } from 'vitest'

import {
  APTITUDE_REFS,
  LINEAGE_SLOT_COUNT,
  explainAptitudes,
  lineageAptitudes,
  lineageEligibility,
  lineageSkillIds,
  lineageSteps,
  upgradedGrade,
} from './lineage'
import type { Aptitudes, Grade } from './types'

const aptitudes = (long: Grade, rest: Grade = 'C'): Aptitudes => ({
  surface: { turf: rest, dirt: rest },
  distance: { sprint: rest, mile: rest, medium: rest, long },
  strategy: { front: rest, pace: rest, late: rest, end: rest },
})

const slot = (id: string, long: Grade, charaId = id) => ({
  id,
  charaId,
  aptitudes: aptitudes(long),
  awakeningSkillIds: [`${id}-1`, `${id}-2`],
})

const LONG = APTITUDE_REFS.find((ref) => ref.key === 'long')!
const full = (grade: Grade) =>
  Array.from({ length: LINEAGE_SLOT_COUNT }, (_, i) => slot(`p${i}`, grade))

describe('aptitude steps', () => {
  it('gives one step per supporting slot beyond the first', () => {
    for (let count = 0; count <= LINEAGE_SLOT_COUNT; count += 1) {
      const lineage = Array.from({ length: count }, (_, i) => slot(`p${i}`, 'A'))
      expect(lineageSteps(lineage, LONG)).toBe(Math.max(0, count - 1))
    }
  })

  it('counts S as supporting and anything below A as not', () => {
    expect(lineageSteps([slot('a', 'S'), slot('b', 'S')], LONG)).toBe(1)
    expect(lineageSteps([slot('a', 'B'), slot('b', 'B'), slot('c', 'B')], LONG)).toBe(0)
  })
})

describe('the two constraints the design requires', () => {
  it('lets a perfect lineage rescue a base F all the way to A', () => {
    expect(upgradedGrade('F', full('A'), LONG)).toBe('A')
  })

  it('never lets a base G reach A, even with a perfect lineage', () => {
    expect(upgradedGrade('G', full('A'), LONG)).toBe('B')
    expect(upgradedGrade('G', full('S'), LONG)).toBe('B')
  })

  it('caps every upgrade at A and never grants an S to a grade that lacked one', () => {
    for (const base of ['G', 'F', 'E', 'D', 'C', 'B', 'A'] as Grade[]) {
      const result = upgradedGrade(base, full('S'), LONG)
      expect(result).not.toBe('S')
      expect(['A', 'B']).toContain(result)
    }
  })

  it('leaves an S alone rather than demoting it', () => {
    expect(upgradedGrade('S', [], LONG)).toBe('S')
  })

  it('does nothing with a single slot', () => {
    expect(upgradedGrade('F', [slot('a', 'A')], LONG)).toBe('F')
  })
})

describe('lineageAptitudes', () => {
  it('moves only the aptitudes the lineage actually supports', () => {
    const base = aptitudes('F', 'G')
    const result = lineageAptitudes(base, full('A'))
    expect(result.distance.long).toBe('A')
    // The slots grade everything else C, so nothing else moves.
    expect(result.distance.sprint).toBe('G')
    expect(result.surface.turf).toBe('G')
  })

  it('does not mutate the base aptitudes', () => {
    const base = aptitudes('F')
    const snapshot = JSON.parse(JSON.stringify(base))
    lineageAptitudes(base, full('A'))
    expect(base).toEqual(snapshot)
  })

  it('returns the base unchanged with no lineage', () => {
    const base = aptitudes('D')
    expect(lineageAptitudes(base, [])).toEqual(base)
  })
})

describe('explainAptitudes', () => {
  it('names which slots moved a grade', () => {
    const rows = explainAptitudes(aptitudes('F'), [slot('a', 'A'), slot('b', 'A'), slot('c', 'D')])
    const long = rows.find((row) => row.key === 'long')!
    expect(long).toMatchObject({ base: 'F', result: 'E', steps: 1 })
    expect(long.supportingTemplateIds).toEqual(['a', 'b'])
  })

  it('covers all ten individual aptitudes', () => {
    expect(explainAptitudes(aptitudes('C'), [])).toHaveLength(10)
  })
})

describe('lineage skills', () => {
  it('collects baseline skills in slot order, deduplicated', () => {
    expect(lineageSkillIds([slot('a', 'A'), slot('b', 'A'), slot('a', 'A')])).toEqual([
      'a-1', 'a-2', 'b-1', 'b-2',
    ])
  })

  it('is empty with no lineage', () => {
    expect(lineageSkillIds([])).toEqual([])
  })
})

describe('eligibility', () => {
  const child = { id: 'child', charaId: 'chara-child' }

  it('rejects the Uma herself, including another of her outfits', () => {
    expect(lineageEligibility({ id: 'child', charaId: 'chara-child' }, child, [])).toMatchObject({ eligible: false })
    expect(lineageEligibility({ id: 'other-outfit', charaId: 'chara-child' }, child, []).reason).toBe("That's her")
  })

  it('rejects a character already in the lineage', () => {
    const occupied = [{ id: 'a', charaId: 'chara-a' }]
    expect(lineageEligibility({ id: 'a2', charaId: 'chara-a' }, child, occupied).reason).toBe('Already in the lineage')
    expect(lineageEligibility({ id: 'b', charaId: 'chara-b' }, child, occupied).eligible).toBe(true)
  })

  it('lets a slot keep its own occupant when re-picking', () => {
    const occupied = [{ id: 'a', charaId: 'chara-a' }]
    expect(lineageEligibility({ id: 'a', charaId: 'chara-a' }, child, occupied, {
      ignoreSlotTemplateId: 'a',
    }).eligible).toBe(true)
  })
})
